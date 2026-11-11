// 드롭존 렌더러에 노출하는 최소 API. nodeIntegration 없이 contextIsolation 으로 격리한다.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('collector', {
  // 탐색기에서 끌어온 파일은 경로가 있다. 브라우저에서 끌어온 이미지 등은 경로가 없어 바이트로 보낸다.
  async dropFiles(files) {
    const items = [];
    for (const f of files) {
      const p = webUtils.getPathForFile(f);
      if (p) items.push({ name: f.name, type: f.type, path: p });
      else items.push({ name: f.name, type: f.type, bytes: new Uint8Array(await f.arrayBuffer()) });
    }
    return ipcRenderer.invoke('drop:files', items);
  },
  dropText: (payload) => ipcRenderer.invoke('drop:text', payload),
  onLog: (cb) => ipcRenderer.on('log', (_e, msg) => cb(msg)),
});
