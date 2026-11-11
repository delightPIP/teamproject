// 렌더러(드롭존·설정)에 노출하는 최소 API. nodeIntegration 없이 contextIsolation으로 격리한다 (ADR 0001 5장).
import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { CollectorBridge, DropFileItem, DropInput, SettingsBridge } from "./ipcTypes.ts";

/** 탐색기에서 끌어온 파일은 경로로, 경로가 없는 파일(브라우저 이미지·붙여넣은 캡처)은 바이트로 넘긴다 */
async function toItems(files: File[], dirs: boolean[]): Promise<DropFileItem[]> {
  return Promise.all(
    files.map(async (f, i) => {
      const base = { name: f.name, type: f.type, size: f.size, isDirectory: !!dirs[i] };
      const p = webUtils.getPathForFile(f);
      if (p) return { ...base, path: p };
      if (base.isDirectory) return base;
      return { ...base, bytes: new Uint8Array(await f.arrayBuffer()) };
    }),
  );
}

const collector: CollectorBridge = {
  // File 객체는 IPC로 그대로 못 넘긴다 → 경로·바이트로 바꾼다
  async saveFiles(files, dirs, source) {
    const payload: DropInput = { files: await toItems(files, dirs) };
    return ipcRenderer.invoke("save", payload, source);
  },
  saveText: (input, source) => ipcRenderer.invoke("save", input satisfies DropInput, source),
  confirm: (input) => ipcRenderer.invoke("confirm", input),
  status: () => ipcRenderer.invoke("status"),
  setMode: (mode, height) => ipcRenderer.send("set-mode", mode, height),
  openUniverse: () => ipcRenderer.send("open-universe"),
  openSettings: () => ipcRenderer.send("open-settings"),
  metric: (entry) => ipcRenderer.send("metric", entry),
  onShortcutResult: (cb) => void ipcRenderer.on("shortcut-result", (_e, r) => cb(r)),
  onStatus: (cb) => void ipcRenderer.on("status", (_e, s) => cb(s)),
  onSaving: (cb) => void ipcRenderer.on("saving", () => cb()),
};

const settings: SettingsBridge = {
  get: () => ipcRenderer.invoke("settings:get"),
  update: (patch) => ipcRenderer.invoke("settings:update", patch),
  storage: () => ipcRenderer.invoke("settings:storage"),
  openVault: () => ipcRenderer.send("settings:open-vault"),
  chooseVault: () => ipcRenderer.invoke("settings:choose-vault"),
};

contextBridge.exposeInMainWorld("collector", collector);
contextBridge.exposeInMainWorld("collectorSettings", settings);
contextBridge.exposeInMainWorld("collectorEvents", {
  onExpand: (cb: () => void) => void ipcRenderer.on("expand", () => cb()),
  onToast: (cb: (m: string) => void) => void ipcRenderer.on("toast", (_e, m) => cb(m)),
});
