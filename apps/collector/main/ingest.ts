// 기록 넣기: 드롭·붙여넣기·전역 단축키 → POST /api/stars (SPEC 3-2, POLICY 2-6·3-3).
import type { BulkUpdateStarsRequest, CreateStarsResponse, Star, StarsResponse } from "@spacelog/shared/types";
import { clipboard } from "electron";
import { openAsBlob } from "node:fs";
import { stat } from "node:fs/promises";
import { classifyText, cleanMemo, errorText, precheckFiles, rejectionLines, starTitle, type Rejected } from "../dropzone/precheck.ts";
import type { Api, ApiFailure } from "./api.ts";
import type { ConfirmInput, DropFileItem, DropInput, SaveResult } from "./ipcTypes.ts";

type Source = SaveResult["source"];

function failureText(f: ApiFailure): string {
  // 서버 2/4(#33) 전에는 POST /api/stars 자체가 없다 → NOT_FOUND. "찾는 기록이 없어요"는 맞지 않는 문구라 따로 둔다
  if (f.code === "NOT_FOUND") return "로컬 서버가 아직 기록 넣기를 지원하지 않아요";
  return f.message ?? errorText(f.code);
}

function toResult(source: Source, res: CreateStarsResponse, extra: Rejected[], serverMs: number): SaveResult {
  const lines = rejectionLines({ duplicates: res.duplicates, rejected: [...extra, ...res.rejected] });
  return {
    source,
    stars: res.created.map((s: Star) => ({ id: s.id, kind: s.kind, title: starTitle(s), planetId: s.planetId })),
    lines,
    error: res.created.length === 0 && lines.length === 0 ? "저장된 별이 없어요" : null,
    serverMs,
  };
}

function onlyRejected(source: Source, rejected: Rejected[]): SaveResult {
  return { source, stars: [], lines: rejectionLines({ duplicates: [], rejected }), error: null, serverMs: 0 };
}

export class Ingest {
  private api: Api;
  constructor(api: Api) {
    this.api = api;
  }

  save(input: DropInput, source: Source): Promise<SaveResult> {
    return "files" in input ? this.saveFiles(input.files, source) : this.saveText(input.uriList, input.text, source);
  }

  async saveFiles(items: DropFileItem[], source: Source): Promise<SaveResult> {
    // 경로가 있으면 실제 파일 정보로 다시 확인한다 (렌더러의 폴더 판별은 브라우저 API라 틀릴 수 있다)
    const checked = await Promise.all(
      items.map(async (it) => {
        if (!it.path) return it;
        try {
          const st = await stat(it.path);
          return { ...it, isDirectory: st.isDirectory(), size: st.size };
        } catch {
          return it;
        }
      }),
    );
    const { accepted, rejected } = precheckFiles(checked);
    if (accepted.length === 0) return onlyRejected(source, rejected);

    const form = new FormData();
    for (const i of accepted) {
      const it = checked[i];
      const blob = it.path
        ? await openAsBlob(it.path, { type: it.type || "application/octet-stream" })
        : new Blob([(it.bytes ?? new Uint8Array()) as Uint8Array<ArrayBuffer>], { type: it.type || "application/octet-stream" });
      form.append("files", blob, it.name);
    }
    return this.post(form, rejected, source);
  }

  async saveText(uriList: string, text: string, source: Source): Promise<SaveResult> {
    const p = classifyText(uriList, text);
    if (p.kind === "empty") return onlyRejected(source, [{ name: null, code: "TEXT_EMPTY", message: errorText("TEXT_EMPTY") }]);
    if (p.kind === "longText") {
      // 100,000자 초과 → .txt 파일로 저장 (SPEC 3-2, POLICY 2-6)
      const bytes = new TextEncoder().encode(p.text);
      const name = `텍스트-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`;
      return this.saveFiles([{ name, type: "text/plain", size: bytes.byteLength, isDirectory: false, bytes }], source);
    }
    const body = p.kind === "link" ? { kind: "link", url: p.url } : { kind: "text", text: p.text };
    return this.post(JSON.stringify(body), [], source, true);
  }

  /** 전역 단축키: 지금 클립보드 1건 (SPEC 1-2). Electron 45는 비동기 W3C 방식 clipboard.read() */
  async saveClipboard(): Promise<SaveResult> {
    let items: Awaited<ReturnType<typeof clipboard.read>> = [];
    try {
      items = await clipboard.read();
    } catch (err) {
      console.warn("[collector] clipboard.read 실패, 텍스트만 읽는다", err);
    }
    const image = items.find((it) => it.types.some((t) => t.startsWith("image/")));
    if (image) {
      const type = image.types.find((t) => t.startsWith("image/"))!;
      const blob = (await image.getType(type)) as Blob;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const ext = type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
      const name = `클립보드-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${ext}`;
      return this.saveFiles([{ name, type, size: bytes.byteLength, isDirectory: false, bytes }], "shortcut");
    }
    const text = await clipboard.readText();
    if (text.trim()) return this.saveText("", text, "shortcut");
    const formats = items.flatMap((it) => it.types).filter((t) => !t.startsWith("text/"));
    if (formats.length > 0) {
      return onlyRejected("shortcut", [{ name: null, code: "UNSUPPORTED_CLIPBOARD", message: errorText("UNSUPPORTED_CLIPBOARD", { format: formats[0] }) }]);
    }
    return onlyRejected("shortcut", [{ name: null, code: "TEXT_EMPTY", message: errorText("TEXT_EMPTY") }]);
  }

  /** 넣은 직후 확인 카드 [완료]·자동 확정 → PATCH /api/stars (SPEC 2-6) */
  async confirm(input: ConfirmInput): Promise<{ ok: boolean; error: string | null }> {
    const body: BulkUpdateStarsRequest = { ids: input.ids };
    if (input.planetId) body.planetId = input.planetId;
    if (input.memo !== undefined) body.memo = input.memo ? cleanMemo(input.memo) : null;
    if (body.planetId === undefined && body.memo === undefined) return { ok: true, error: null };
    const res = await this.api.request<StarsResponse>("PATCH", "/api/stars", body);
    if (res.ok) return { ok: true, error: null };
    return { ok: false, error: res.code === "NOT_FOUND" ? "로컬 서버가 아직 메모·행성 바꾸기를 지원하지 않아요" : (res.message ?? errorText(res.code)) };
  }

  private async post(body: FormData | string, extra: Rejected[], source: Source, json = false): Promise<SaveResult> {
    const t0 = performance.now();
    const res = await this.api.request<CreateStarsResponse>("POST", "/api/stars", json ? JSON.parse(body as string) : body);
    const serverMs = Math.round(performance.now() - t0);
    if (res.ok) return toResult(source, res.data, extra, serverMs);
    // 요청 전체가 실패: 사전 검사로 거부한 항목도 같이 보여 준다
    return { source, stars: [], lines: rejectionLines({ duplicates: [], rejected: extra }), error: failureText(res), serverMs };
  }
}
