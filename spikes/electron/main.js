// ADR 0001 스파이크: Electron 후보 (A)
// 드롭존 창 + 트레이 + 전역 단축키 + 알림 + utilityProcess 서버만 있는 최소 수집 앱.
// 측정값은 userData/spike-metrics.json 에 쌓인다.
const {
  app, BrowserWindow, Tray, Menu, Notification, nativeImage, utilityProcess,
  globalShortcut, clipboard, ipcMain, shell, screen,
} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const launchEpoch = Number(process.env.SPIKE_LAUNCH_EPOCH || 0);
const autoQuitSec = Number(process.env.SPIKE_AUTO_QUIT_SEC || 0);
const selfTest = process.env.SPIKE_SELFTEST === '1'; // 사람 손 없이 확인 가능한 항목만 자동 실행

// 드롭존은 작은 2D 창이라 GPU 프로세스 없이 그려도 된다. 메모리 비교용 스위치.
if (process.env.SPIKE_NO_GPU === '1') app.disableHardwareAcceleration();

if (!app.requestSingleInstanceLock()) app.quit();
// 개발 모드에서는 이 AUMID를 등록한 시작 메뉴 바로가기가 없어 알림 클릭이 앱으로 돌아오지 않을 수 있다.
// SPIKE_NO_AUMID=1 이면 Electron 기본값을 쓴다 (알림 클릭 실험용).
if (process.env.SPIKE_NO_AUMID !== '1') app.setAppUserModelId('com.spacelog.spike');

const metricsFile = () => path.join(app.getPath('userData'), 'spike-metrics.json');
const metrics = { platform: process.platform, arch: process.arch, electron: process.versions.electron, node: process.versions.node, events: [] };
function record(key, value) {
  if (key === 'event') metrics.events.push({ at: new Date().toISOString(), ...value });
  else metrics[key] = value;
  try { fs.writeFileSync(metricsFile(), JSON.stringify(metrics, null, 2)); } catch {}
}

let win, tray, server, port;
const token = crypto.randomBytes(32).toString('base64url'); // SPEC 3-1
let restarts = 0;
let shownAt = null, healthAt = null, appReadyAt = null;

const log = (msg) => { console.log(msg); win?.webContents.send('log', msg); };

// ---------- 서버 (utilityProcess) ----------
function startServer() {
  server = utilityProcess.fork(path.join(__dirname, 'server.js'), [], {
    serviceName: 'spacelog-server',
    env: {
      ...process.env,
      SPACELOG_TOKEN: token,
      SPACELOG_PORT: '47800',
      SPACELOG_VAULT: path.join(app.getPath('userData'), 'vault', 'tmp'),
    },
  });
  server.on('message', async (m) => {
    if (m.type !== 'listening') return log(`서버 오류: ${m.message}`);
    port = m.port;
    const res = await api('GET', '/api/health');
    healthAt = Date.now();
    record('server', { port, pid: server.pid, health: res });
    maybeReady();
  });
  server.on('exit', (code) => {
    log(`서버 종료 code=${code}`);
    if (app.isQuitting) return;
    if (restarts++ < 1) return startServer(); // 1번 자동 재시작 (POLICY 3장)
    tray?.setToolTip('SpaceLog - 서버 오류');
    new Notification({ title: 'SpaceLog', body: '로컬 서버를 다시 켜지 못했어요' }).show();
  });
}

async function api(method, url, body, headers = {}) {
  const res = await fetch(`http://127.0.0.1:${port}${url}`, {
    method, body, headers: { authorization: `Bearer ${token}`, ...headers },
  });
  return { status: res.status, ...(await res.json()) };
}

function maybeReady() {
  if (!shownAt || !healthAt) return;
  const readyAt = Math.max(shownAt, healthAt);
  record('startup', {
    sinceProcessStartMs: Math.round(process.uptime() * 1000 - (Date.now() - readyAt)),
    sinceLaunchMs: launchEpoch ? readyAt - launchEpoch : null,
    windowShownMs: launchEpoch ? shownAt - launchEpoch : null,
    serverHealthMs: launchEpoch ? healthAt - launchEpoch : null,
    appReadyMs: launchEpoch ? appReadyAt - launchEpoch : null,
  });
  log(`준비 완료: ${JSON.stringify(metrics.startup)}`);
  if (selfTest) runSelfTest().catch((e) => record('selftest', { error: e.message }));
  setTimeout(measureMemory, 60_000);
}

// ---------- 자가검증 (SPIKE_SELFTEST=1) ----------
// ADR 0001 4장 중 자동으로 확인할 수 있는 부분만 돈다.
// 탐색기→드롭존 드래그와 알림 "클릭"은 사람이 해야 하므로 여기 없다.
async function runSelfTest() {
  const http = require('node:http');
  const raw = (headers, p = '/api/health') => new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method: 'GET', headers, setHost: false }, (res) => {
      res.resume(); res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', (e) => resolve(`ERR ${e.code}`));
    req.end();
  });
  const auth = { authorization: `Bearer ${token}` };
  const okHost = `127.0.0.1:${port}`;
  const security = {
    noToken: await raw({ host: okHost }),                                             // 기대 401
    wrongToken: await raw({ host: okHost, authorization: 'Bearer nope' }),           // 기대 401
    wrongHost: await raw({ host: 'evil.example:80', ...auth }),                      // 기대 403 (DNS 리바인딩)
    foreignOrigin: await raw({ host: okHost, origin: 'http://evil.example', ...auth }), // 기대 403
    ownOrigin: await raw({ host: okHost, origin: `http://${okHost}`, ...auth }),     // 기대 200
    localhostHost: await raw({ host: `localhost:${port}`, ...auth }),                // 기대 200
    good: await raw({ host: okHost, ...auth }),                                      // 기대 200
  };
  const secPass = security.noToken === 401 && security.wrongToken === 401 && security.wrongHost === 403
    && security.foreignOrigin === 403 && security.ownOrigin === 200 && security.localhostHost === 200 && security.good === 200;

  // 1) 경로가 있는 파일 (탐색기 드롭과 같은 IPC 경로) — 1MB 무작위 바이트
  const tmp = path.join(app.getPath('userData'), 'selftest-1mb.bin');
  fs.writeFileSync(tmp, crypto.randomBytes(1024 * 1024));
  const file = await dropFiles([{ name: 'selftest-1mb.bin', type: 'application/octet-stream', path: tmp }]);
  // 2) 경로가 없는 파일 (브라우저에서 끌어온 이미지와 같은 경로) — 바이트 전달
  const bytes = await dropFiles([{ name: 'inline.png', type: 'image/png', bytes: crypto.randomBytes(64 * 1024) }]);
  // 3) 링크 (text/uri-list), 4) 텍스트 (text/plain)
  const link = await dropText({ uriList: 'https://example.com/spike\r\n', text: 'https://example.com/spike' });
  const text = await dropText({ uriList: '', text: '스파이크 자가검증 메모' });
  // 5) 전역 단축키 핸들러 (클립보드에 텍스트를 넣고 같은 함수를 부른다)
  await clipboard.writeText('클립보드 자가검증');
  const shortcut = await captureClipboard();
  // 6) 알림 표시 (클릭은 사람이)
  testNotification();

  const expectBytes = (ev, min) => typeof ev.bytes === 'number' && ev.bytes >= min;
  record('selftest', {
    security, secPass,
    file: { ...file, pass: expectBytes(file, 1024 * 1024) },
    bytes: { ...bytes, pass: expectBytes(bytes, 64 * 1024) },
    link: { ...link, pass: link.kind === 'link' },
    text: { ...text, pass: text.kind === 'text' },
    shortcut: { ...shortcut, pass: shortcut.kind === 'shortcut-text' },
  });
  log(`자가검증: 보안 ${secPass ? 'PASS' : 'FAIL'} ${JSON.stringify(security)}`);
}

// ---------- 메모리 ----------
function measureMemory() {
  const procs = app.getAppMetrics().map((p) => ({
    type: p.type, name: p.name || p.serviceName, pid: p.pid,
    workingSetMB: +(p.memory.workingSetSize / 1024).toFixed(1),
    privateMB: p.memory.privateBytes != null ? +(p.memory.privateBytes / 1024).toFixed(1) : null,
  }));
  const sum = (k) => +procs.reduce((a, p) => a + (p[k] || 0), 0).toFixed(1);
  record('memoryAfter60s', { totalWorkingSetMB: sum('workingSetMB'), totalPrivateMB: sum('privateMB'), procs });
  log(`메모리(1분 후): 합계 ${sum('workingSetMB')}MB (private ${sum('privateMB')}MB)`);
  if (autoQuitSec) setTimeout(() => app.quit(), autoQuitSec * 1000);
}

// ---------- 드롭 → 서버 ----------
async function dropFiles(items) {
  const t0 = Date.now();
  const form = new FormData();
  for (const it of items) {
    const blob = it.path ? await fs.openAsBlob(it.path, { type: it.type }) : new Blob([it.bytes], { type: it.type });
    form.append('files', blob, it.name);
  }
  const res = await api('POST', '/api/stars', form);
  const ev = { kind: 'files', count: items.length, withPath: items.filter((i) => i.path).length, names: items.map((i) => i.name), ms: Date.now() - t0, bytes: res.bytes };
  record('event', ev);
  return ev;
}

async function dropText({ uriList, text }) {
  const t0 = Date.now();
  const url = (uriList || '').split(/\r?\n/).find((l) => l && !l.startsWith('#'));
  const kind = url || /^https?:\/\/\S+$/.test((text || '').trim()) ? 'link' : 'text';
  const body = JSON.stringify(kind === 'link' ? { kind, url: url || text.trim() } : { kind, text });
  const res = await api('POST', '/api/stars', body, { 'content-type': 'application/json' });
  const ev = { kind, preview: (url || text || '').slice(0, 60), ms: Date.now() - t0, bytes: res.bytes };
  record('event', ev);
  return ev;
}

ipcMain.handle('drop:files', (_e, items) => dropFiles(items));
ipcMain.handle('drop:text', (_e, payload) => dropText(payload));

// ---------- 알림 ----------
// 알림 객체를 붙잡아 두지 않으면 GC로 사라져 click 이벤트가 오지 않는다 (윈도우에서 확인)
const liveNotifications = new Set();
function testNotification() {
  const n = new Notification({ title: '7일 전 오늘의 별 ✦', body: '스파이크 테스트 별 · 이미지' });
  liveNotifications.add(n);
  n.on('close', () => liveNotifications.delete(n));
  n.on('show', () => record('event', { kind: 'notification', type: 'shown' }));
  n.on('click', () => {
    liveNotifications.delete(n);
    record('event', { kind: 'notification', type: 'clicked' });
    log('알림 클릭됨 → 웹 열기');
    shell.openExternal(`http://127.0.0.1:${port}/#/star/test?from=rediscovery&token=${token}`);
  });
  n.show();
}

// ---------- 단축키 ----------
async function captureClipboard() {
  // Electron 45: 클립보드 API가 W3C 방식(비동기, ClipboardItem)으로 바뀌었다
  const items = await clipboard.read();
  const imgItem = items.find((it) => it.types.some((t) => t.startsWith('image/')));
  const text = imgItem ? '' : await clipboard.readText();
  let ev;
  if (imgItem) {
    const type = imgItem.types.find((t) => t.startsWith('image/'));
    const blob = await imgItem.getType(type);
    const form = new FormData();
    form.append('files', blob, `clipboard.${type.split('/')[1]}`);
    const t0 = Date.now();
    const res = await api('POST', '/api/stars', form);
    ev = { kind: 'shortcut-image', ms: Date.now() - t0, bytes: res.bytes };
  } else if (text) {
    const t0 = Date.now();
    const res = await api('POST', '/api/stars', JSON.stringify({ kind: 'text', text }), { 'content-type': 'application/json' });
    ev = { kind: 'shortcut-text', ms: Date.now() - t0, bytes: res.bytes };
  } else {
    ev = { kind: 'shortcut-empty' };
  }
  record('event', ev);
  log(`단축키: ${JSON.stringify(ev)}`);
  return ev;
}

function registerShortcut() {
  const accel = 'CommandOrControl+Shift+Space';
  const ok = globalShortcut.register(accel, captureClipboard);
  record('shortcut', { accelerator: accel, registered: ok });
}

// ---------- 창·트레이 ----------
function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    width: 280, height: 320,
    x: workArea.x + workArea.width - 290, y: workArea.y + Math.round(workArea.height / 3),
    frame: false, resizable: false, alwaysOnTop: true, skipTaskbar: true, show: false,
    backgroundColor: '#14142a',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadFile(path.join(__dirname, 'dropzone.html'));
  win.once('ready-to-show', () => { win.showInactive(); shownAt = Date.now(); maybeReady(); });
}

function createTray() {
  // 16x16 BGRA 단색 아이콘 (파일 없이)
  const size = 16, buf = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) buf.set([0xd3, 0x6a, 0x6a, 0xff], i * 4);
  tray = new Tray(nativeImage.createFromBitmap(buf, { width: size, height: size }));
  tray.setToolTip('SpaceLog (스파이크)');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '우주 보기', click: () => shell.openExternal(`http://127.0.0.1:${port}/#/?token=${token}`) },
    { label: '드롭존 보이기/숨기기', click: () => (win.isVisible() ? win.hide() : win.showInactive()) },
    { label: '알림 테스트', click: testNotification },
    { label: '메모리 지금 측정', click: measureMemory },
    { label: '측정 파일 열기', click: () => shell.showItemInFolder(metricsFile()) },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() },
  ]));
}

app.whenReady().then(() => {
  appReadyAt = Date.now();
  try { fs.rmSync(metricsFile()); } catch {}
  record('startedAt', new Date().toISOString());
  startServer();
  createWindow();
  createTray();
  registerShortcut();
});
app.on('before-quit', () => { app.isQuitting = true; });
app.on('will-quit', () => { globalShortcut.unregisterAll(); server?.kill(); });
app.on('window-all-closed', (e) => e.preventDefault?.());
