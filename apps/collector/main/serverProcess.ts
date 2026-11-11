// 로컬 서버 실행·재시작, 포트·토큰 관리 (SPEC 3-1, POLICY 1-3·3-1, ADR 0001 5장).
// 서버는 utilityProcess로 띄운다: 서버가 죽어도 드롭존은 살아 있어야 재시작·빨간 점을 보여 줄 수 있다.
import { utilityProcess, type UtilityProcess } from "electron";
import { randomBytes } from "node:crypto";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import path from "node:path";

export type ServerState = "starting" | "ok" | "error";

export interface ServerOptions {
  entry: string; // dist/server.mjs
  vaultPath: string;
  webDir: string | null;
  basePort?: number;
}

export const DEFAULT_PORT = 47800; // SPEC 6장 S2 확정
export const MAX_AUTO_RESTARTS = 1; // POLICY 3-1: 1번 자동 재시작, 또 꺼지면 오류 표시

/** 세션 토큰: 무작위 32바이트 base64url (SPEC 3-1, POLICY 1-3). 앱을 켤 때마다 새로 만든다 */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export class ServerProcess extends EventEmitter<{ state: [ServerState, string | null] }> {
  readonly token = newSessionToken();
  port: number | null = null;
  state: ServerState = "starting";
  lastError: string | null = null;
  private child: UtilityProcess | null = null;
  private restarts = 0;
  private stopping = false;

  private opts: ServerOptions;

  constructor(opts: ServerOptions) {
    super();
    this.opts = opts;
  }

  get baseUrl(): string | null {
    return this.state === "ok" && this.port ? `http://127.0.0.1:${this.port}` : null;
  }

  start(): void {
    this.setState("starting", null);
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      SPACELOG_TOKEN: this.token,
      SPACELOG_PORT: String(this.port ?? this.opts.basePort ?? DEFAULT_PORT),
      SPACELOG_VAULT: this.opts.vaultPath,
    };
    // 사용자 PC에 남은 SPACELOG_WEB_DIR이 새지 않게, 웹 위치는 수집 앱이 정한 값만 넘긴다
    delete env.SPACELOG_WEB_DIR;
    if (this.opts.webDir && existsSync(this.opts.webDir)) env.SPACELOG_WEB_DIR = this.opts.webDir;
    const child = utilityProcess.fork(this.opts.entry, [], { serviceName: "SpaceLog 로컬 서버", env, stdio: "inherit" });
    this.child = child;

    child.on("message", (m: { type?: string; port?: number; message?: string }) => {
      if (m?.type === "listening" && typeof m.port === "number") {
        this.port = m.port;
        void this.waitHealthy();
      } else if (m?.type === "error") {
        this.lastError = m.message ?? "알 수 없는 오류";
        console.error("[collector] 서버 시작 실패:", this.lastError);
      }
    });
    child.on("exit", (code) => {
      if (this.child === child) this.child = null;
      if (this.stopping) return;
      console.warn(`[collector] 서버 종료 code=${code} (자동 재시작 ${this.restarts}/${MAX_AUTO_RESTARTS})`);
      if (this.restarts < MAX_AUTO_RESTARTS) {
        this.restarts++;
        this.start();
      } else {
        this.setState("error", this.lastError ?? `로컬 서버가 꺼졌어요 (code ${code})`);
      }
    });
  }

  /** 사용자가 트레이에서 다시 켤 때 / 보관함 위치를 바꿨을 때. 자동 재시작 횟수를 되돌린다 */
  restart(opts?: Partial<ServerOptions>): void {
    Object.assign(this.opts, opts);
    this.restarts = 0;
    this.lastError = null;
    if (this.child) {
      const old = this.child;
      this.stopping = true;
      old.once("exit", () => {
        this.stopping = false;
        this.start();
      });
      old.kill();
    } else {
      this.start();
    }
  }

  stop(): void {
    this.stopping = true;
    this.child?.kill();
  }

  get pid(): number | undefined {
    return this.child?.pid;
  }

  private async waitHealthy(): Promise<void> {
    // listening 직후라 보통 첫 시도에 된다. 10번(약 2초)까지 기다린다
    for (let i = 0; i < 10; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${this.port}/api/health`, { headers: { "x-session-token": this.token } });
        if (res.ok) return this.setState("ok", null);
      } catch {
        /* 다시 시도 */
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    this.setState("error", "로컬 서버가 health 요청에 답하지 않아요");
  }

  private setState(state: ServerState, error: string | null): void {
    this.state = state;
    if (error) this.lastError = error;
    this.emit("state", state, error);
  }
}

/**
 * 웹 빌드 위치.
 * - 배포 빌드: 설치 폴더의 resources/web (package.mjs가 web/dist를 extraResource로 싣는다). 환경 변수는 읽지 않는다
 * - 개발: 환경 변수 → 저장소의 web/dist
 */
export function resolveWebDir(appRoot: string, packaged?: { resourcesPath: string }): string | null {
  if (packaged) {
    const dir = path.join(packaged.resourcesPath, "web");
    return existsSync(dir) ? dir : null;
  }
  if (process.env.SPACELOG_WEB_DIR) return process.env.SPACELOG_WEB_DIR;
  const dir = path.resolve(appRoot, "../../web/dist");
  return existsSync(dir) ? dir : null;
}
