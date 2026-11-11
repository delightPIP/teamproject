// 수집 앱 진입점 (이슈 #6, SPEC 1-1~1-3·3-1·3-2·3-6, ADR 0001).
// 드롭존 창 + 트레이 + 전역 단축키 + 재발견 알림 + 로컬 서버(utilityProcess).
import type { Settings, UniverseResponse } from "@spacelog/shared/types";
import { BrowserWindow, Notification, app, dialog, ipcMain, screen, shell } from "electron";
import { appendFileSync, mkdirSync } from "node:fs";
import { readdir, stat, statfs } from "node:fs/promises";
import path from "node:path";
import { Api } from "./api.ts";
import { Ingest } from "./ingest.ts";
import type { ConfirmInput, DropInput, DropzoneMode, DropzoneStatus, SaveResult, SettingsView, StorageInfo } from "./ipcTypes.ts";
import { Notifier } from "./notifier.ts";
import { localDateOf } from "./notifySchedule.ts";
import { ServerProcess, resolveWebDir } from "./serverProcess.ts";
import { SettingsStore } from "./settingsStore.ts";
import { Shortcut, shortcutLabel } from "./shortcut.ts";
import { AppTray } from "./tray.ts";

const APP_ROOT = path.resolve(__dirname, ".."); // apps/collector
const DIST = __dirname; // apps/collector/dist

if (!app.requestSingleInstanceLock()) {
  // 두 번째 실행: 서버·트레이를 또 만들지 않고 바로 끝낸다 (첫 인스턴스가 second-instance로 드롭존을 펼침)
  app.quit();
  process.exit(0);
}
app.setAppUserModelId("com.spacelog.collector");
// 드롭존은 작은 2D 창이라 GPU 가속 없이 그려도 된다. 스파이크에서 private 메모리 174→113MB (ADR 0001 4장)
if (process.env.SPACELOG_GPU !== "1") app.disableHardwareAcceleration();

let quitting = false;
let dropzone: BrowserWindow | null = null;
let settingsWin: BrowserWindow | null = null;
let tray: AppTray | null = null;
let vaultOk = true;
let lastStatus: DropzoneStatus | null = null;
let selfTested = false;

const settings = new SettingsStore();
// 개발 전용: SPACELOG_SERVER_ENTRY=dev/mockServer.mjs 이면 가짜 서버로 띄운다 (서버 2/4 머지 전 확인용)
const serverEntry = !app.isPackaged && process.env.SPACELOG_SERVER_ENTRY ? path.resolve(APP_ROOT, process.env.SPACELOG_SERVER_ENTRY) : path.join(DIST, "server.mjs");
const server = new ServerProcess({ entry: serverEntry, vaultPath: settings.get().vaultPath, webDir: resolveWebDir(APP_ROOT, app.isPackaged ? { resourcesPath: process.resourcesPath } : undefined) });
const api = new Api(server);
const ingest = new Ingest(api);
const shortcut = new Shortcut(() => void onShortcut());
const notifier = new Notifier(api, settings, (id) => openWeb(`#/star/${encodeURIComponent(id)}?from=rediscovery`));

// ---------- 측정 (이슈 #6: 드롭 → 저장 완료 3초, 대기 메모리) ----------
const metricsFile = () => path.join(app.getPath("userData"), "collector-metrics.jsonl");
function metric(entry: Record<string, unknown>): void {
  try {
    appendFileSync(metricsFile(), JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n");
  } catch {
    /* 측정 실패는 무시 */
  }
}
function measureMemory(label: string): void {
  const procs = app.getAppMetrics().map((p) => ({
    type: p.type,
    name: p.name || p.serviceName,
    workingSetMB: +(p.memory.workingSetSize / 1024).toFixed(1),
    privateMB: p.memory.privateBytes != null ? +(p.memory.privateBytes / 1024).toFixed(1) : null,
  }));
  const sum = (k: "workingSetMB" | "privateMB") => +procs.reduce((a, p) => a + (p[k] ?? 0), 0).toFixed(1);
  metric({ kind: "memory", label, totalWorkingSetMB: sum("workingSetMB"), totalPrivateMB: sum("privateMB"), procs });
}

// ---------- 웹 열기 (SPEC 3-3: 사용자 브라우저로) ----------
/** hashPath 예: "#/" 또는 "#/star/ID?from=rediscovery". 토큰은 해시 쿼리로 붙인다 */
function webUrl(hashPath: string): string | null {
  // 개발: Vite 개발 서버로 열고 싶으면 SPACELOG_WEB_URL=http://localhost:5173 (배포 빌드에서는 읽지 않음)
  const base = !app.isPackaged && process.env.SPACELOG_WEB_URL ? process.env.SPACELOG_WEB_URL.replace(/\/$/, "") : server.baseUrl;
  if (!base) return null;
  const sep = hashPath.includes("?") ? "&" : "?";
  return `${base}/${hashPath}${sep}token=${encodeURIComponent(server.token)}`;
}
function openWeb(hashPath: string): void {
  const url = webUrl(hashPath);
  if (url) void shell.openExternal(url);
  else showError("로컬 서버가 꺼져 있어요. 트레이 메뉴를 확인해 주세요");
}
async function openRediscovery(): Promise<void> {
  const res = await api.request<{ star: { id: string } } | null>("GET", "/api/rediscovery/today");
  if (res.ok && res.data) openWeb(`#/star/${encodeURIComponent(res.data.star.id)}?from=rediscovery`);
  else openWeb("#/"); // 오늘의 별이 없거나 API가 아직 없으면 우주 홈 (홈의 재발견 카드)
}
function showError(message: string): void {
  dropzone?.webContents.send("toast", message);
}

// ---------- 드롭존 창 (SPEC 1-1) ----------
const MODE_SIZE: Record<DropzoneMode, { width: number; height: number }> = {
  collapsed: { width: 52, height: 116 },
  expanded: { width: 288, height: 236 },
  confirm: { width: 332, height: 360 },
};
const EDGE_GAP = 6;

function placeDropzone(mode: DropzoneMode, height?: number): void {
  if (!dropzone) return;
  const { workArea } = screen.getDisplayMatching(dropzone.getBounds());
  const size = { ...MODE_SIZE[mode] };
  if (height) size.height = Math.min(Math.max(height, 120), workArea.height - 40);
  const cur = dropzone.getBounds();
  // 오른쪽 가장자리에 붙인다. 세로 위치는 유지하되 화면 밖으로 나가지 않게
  const x = workArea.x + workArea.width - size.width - EDGE_GAP;
  const y = Math.min(Math.max(cur.y, workArea.y + 8), workArea.y + workArea.height - size.height - 8);
  dropzone.setBounds({ x, y, ...size });
  if (mode === "confirm") {
    // Enter·Esc·메모 입력을 받으려면 포커스가 필요하다. 윈도우는 showInactive 창의 포커스를 막을 수 있어 moveTop 먼저
    dropzone.moveTop();
    dropzone.focus();
  } else if (mode === "collapsed" && dropzone.isFocused()) {
    dropzone.blur(); // 접힌 뒤에도 키 입력을 가져가지 않게
  }
}

function createDropzone(): void {
  const { workArea } = screen.getPrimaryDisplay();
  const { width, height } = MODE_SIZE.collapsed;
  dropzone = new BrowserWindow({
    width,
    height,
    x: workArea.x + workArea.width - width - EDGE_GAP,
    y: workArea.y + Math.round(workArea.height / 3),
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true, // 작업 표시줄 아이콘 없음 (맥은 app.dock.hide)
    show: false,
    backgroundColor: "#0e0f24",
    title: "SpaceLog 드롭존",
    webPreferences: { preload: path.join(DIST, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  dropzone.setAlwaysOnTop(true, "floating");
  void dropzone.loadFile(path.join(DIST, "dropzone.html"));
  dropzone.once("ready-to-show", () => {
    dropzone?.showInactive();
    metric({ kind: "startup", windowShownMs: Math.round(process.uptime() * 1000) });
  });
  // 드롭존 안에서 링크를 놓쳐 페이지가 바뀌는 일을 막는다
  dropzone.webContents.on("will-navigate", (e) => e.preventDefault());
  dropzone.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  dropzone.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      dropzone?.hide();
    }
  });
}

function showDropzone(expand = true): void {
  if (!dropzone) return;
  dropzone.showInactive();
  if (expand) dropzone.webContents.send("expand");
}

// ---------- 상태 (오늘 별 개수, 행성 목록, 디스크) ----------
async function freeBytes(dir: string): Promise<number | null> {
  try {
    const s = await statfs(dir);
    return s.bavail * s.bsize;
  } catch {
    return null;
  }
}

async function refreshStatus(): Promise<DropzoneStatus> {
  const today = localDateOf(new Date());
  const [uni, free] = await Promise.all([
    api.request<UniverseResponse>("GET", `/api/universe?from=${today}&to=${today}`),
    freeBytes(settings.get().vaultPath),
  ]);
  lastStatus = {
    server: server.state,
    todayCount: uni.ok ? uni.data.stars.length : null,
    planets: uni.ok ? uni.data.planets.map((p) => ({ id: p.id, name: p.name })) : [],
    freeBytes: free,
    shortcut: shortcutLabel(settings.get().shortcut),
  };
  dropzone?.webContents.send("status", lastStatus);
  return lastStatus;
}

function updateTray(): void {
  tray?.setStatus(server.state === "error" ? "serverError" : !vaultOk ? "vaultError" : "ok");
}

function ensureVault(): boolean {
  try {
    mkdirSync(settings.get().vaultPath, { recursive: true });
    vaultOk = true;
  } catch (err) {
    console.error("[collector] 보관함을 만들 수 없음", err);
    vaultOk = false;
  }
  updateTray();
  return vaultOk;
}

// ---------- 넣기 ----------
function afterSave(r: SaveResult): SaveResult {
  metric({ kind: "save", source: r.source, created: r.stars.length, rejected: r.lines.length, error: r.error, serverMs: r.serverMs });
  if (r.error === "보관함을 찾을 수 없어요") {
    vaultOk = false;
    updateTray();
  }
  if (r.stars.length > 0) void refreshStatus();
  return r;
}

async function onShortcut(): Promise<void> {
  // 단축키도 드롭존을 펼쳐 saving → confirm을 보여 준다 (SPEC 1-2)
  showDropzone(false);
  dropzone?.webContents.send("saving");
  const r = afterSave(await ingest.saveClipboard());
  dropzone?.webContents.send("shortcut-result", r);
}

// ---------- 설정 창 (SPEC 1-2) ----------
function settingsView(): SettingsView {
  return { ...settings.get(), shortcutRegistered: shortcut.registered, notificationTimeEffective: settings.notificationTime(), isPackaged: app.isPackaged };
}

function openSettings(): void {
  if (settingsWin) {
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 460,
    height: 560,
    title: "SpaceLog 설정",
    resizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    backgroundColor: "#0e0f24",
    webPreferences: { preload: path.join(DIST, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  void settingsWin.loadFile(path.join(DIST, "settings.html"));
  settingsWin.on("closed", () => (settingsWin = null));
}

function applyLoginItem(on: boolean): void {
  // 개발 모드에서 켜면 electron.exe만 등록돼 빈 Electron이 뜬다 → 배포 빌드에서만 적용
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: on });
}

async function updateSettings(patch: Partial<Settings>): Promise<{ settings: SettingsView; error: string | null }> {
  let error: string | null = null;
  const prev = settings.get();
  if (patch.shortcut && patch.shortcut !== prev.shortcut) {
    if (!shortcut.register(patch.shortcut)) {
      error = `${shortcutLabel(patch.shortcut)}는 쓸 수 없어요. 다른 앱이 쓰고 있거나 형식이 맞지 않아요`;
      delete patch.shortcut;
    }
  }
  delete patch.lastNotifiedLocalDate; // 알림 기록은 수집 앱만 쓴다
  settings.update(patch);
  if (patch.launchAtLogin !== undefined) applyLoginItem(patch.launchAtLogin);
  if (patch.vaultPath && patch.vaultPath !== prev.vaultPath) {
    ensureVault();
    server.restart({ vaultPath: patch.vaultPath }); // 서버가 새 보관함을 열도록 다시 켠다
  }
  tray?.rebuildMenu();
  void refreshStatus();
  return { settings: settingsView(), error };
}

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) total += await dirSize(p);
    else if (e.isFile()) total += (await stat(p)).size;
  }
  return total;
}

async function storage(): Promise<StorageInfo> {
  const vaultPath = settings.get().vaultPath;
  const [usedBytes, free] = await Promise.all([dirSize(vaultPath).catch(() => null), freeBytes(vaultPath)]);
  return { vaultPath, usedBytes, freeBytes: free };
}

// ---------- IPC ----------
ipcMain.handle("save", async (_e, input: DropInput, source: "drop" | "paste") => afterSave(await ingest.save(input, source)));
ipcMain.handle("confirm", (_e, input: ConfirmInput) => ingest.confirm(input));
ipcMain.handle("status", () => lastStatus ?? refreshStatus());
ipcMain.on("set-mode", (_e, mode: DropzoneMode, height?: number) => placeDropzone(mode, height));
ipcMain.on("open-universe", () => openWeb("#/"));
ipcMain.on("open-settings", () => openSettings());
ipcMain.on("metric", (_e, entry: Record<string, unknown>) => metric({ kind: "dropzone", ...entry }));
ipcMain.handle("settings:get", () => settingsView());
ipcMain.handle("settings:update", (_e, patch: Partial<Settings>) => updateSettings(patch));
ipcMain.handle("settings:storage", () => storage());
ipcMain.on("settings:open-vault", () => void shell.openPath(settings.get().vaultPath));
ipcMain.handle("settings:choose-vault", async () => {
  const r = await dialog.showOpenDialog(settingsWin ?? undefined!, { title: "보관함 위치", properties: ["openDirectory", "createDirectory"], defaultPath: settings.get().vaultPath });
  if (r.canceled || !r.filePaths[0]) return null;
  return updateSettings({ vaultPath: r.filePaths[0] });
});

// ---------- 시작 (SPEC 3-1) ----------
server.on("state", (state, error) => {
  console.log(`[collector] 서버 ${state}${server.port ? ` :${server.port}` : ""}${error ? ` — ${error}` : ""}`);
  updateTray();
  if (state === "ok") {
    metric({ kind: "startup", serverHealthMs: Math.round(process.uptime() * 1000), port: server.port });
    if (!app.isPackaged && process.env.SPACELOG_SELFTEST === "1" && !selfTested) {
      selfTested = true;
      void import("./selftest.ts").then(async ({ runSelfTest }) => {
        const r = await runSelfTest(server, ingest);
        metric({ kind: "selftest", ...r });
        console.log("[collector] 자가검증", JSON.stringify(r, null, 2));
        if (process.env.SPACELOG_SELFTEST_QUIT === "1") app.quit();
      });
    }
    void refreshStatus();
  } else {
    void refreshStatus();
  }
  if (state === "error") {
    // 1번 자동 재시작 후에도 꺼짐 → 트레이 빨간 점 + 운영체제 알림 (POLICY 3-1)
    if (Notification.isSupported()) new Notification({ title: "SpaceLog", body: "로컬 서버를 다시 켜지 못했어요. 트레이 메뉴에서 다시 켜 주세요" }).show();
  }
});

app.on("second-instance", () => showDropzone());

app.whenReady().then(() => {
  if (process.platform === "darwin") app.dock?.hide(); // Dock 아이콘 없음
  ensureVault();
  server.start();
  createDropzone();
  tray = new AppTray({
    openUniverse: () => openWeb("#/"),
    toggleDropzone: () => (dropzone?.isVisible() ? dropzone.hide() : showDropzone()),
    showDropzone: () => showDropzone(),
    saveClipboard: () => void onShortcut(),
    openRediscovery: () => void openRediscovery(),
    openSettings,
    restartServer: () => server.restart(),
    quit: () => app.quit(),
    shortcutLabel: () => shortcutLabel(settings.get().shortcut),
  });
  updateTray();
  if (!shortcut.register(settings.get().shortcut)) {
    console.warn(`[collector] 전역 단축키 등록 실패: ${settings.get().shortcut}`);
    metric({ kind: "shortcut", registered: false, accelerator: settings.get().shortcut });
  }
  applyLoginItem(settings.get().launchAtLogin);
  notifier.start();
  setInterval(() => void refreshStatus(), 60_000);
  setTimeout(() => measureMemory("60s"), 60_000);
});

app.on("before-quit", () => {
  quitting = true;
});
app.on("will-quit", () => {
  shortcut.dispose();
  notifier.stop();
  server.stop();
});
// 창을 모두 닫아도 트레이에 남는다
app.on("window-all-closed", () => {});
