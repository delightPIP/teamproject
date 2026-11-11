// 스파이크 측정: 앱을 띄우고 (실행 시간, 1분 뒤 메모리) 를 읽은 뒤 종료한다.
// 사용: node measure.js [실행파일 경로]   (기본: 패키징된 dist/ 실행 파일, 없으면 개발 모드 electron)
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const appData = process.platform === 'win32' ? process.env.APPDATA
  : process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support')
  : path.join(os.homedir(), '.config');

function findPackaged() {
  const dist = path.join(__dirname, 'dist');
  if (!fs.existsSync(dist)) return null;
  for (const d of fs.readdirSync(dist)) {
    const dir = path.join(dist, d);
    const exe = process.platform === 'win32' ? path.join(dir, 'SpaceLogSpike.exe')
      : process.platform === 'darwin' ? path.join(dir, 'SpaceLogSpike.app', 'Contents', 'MacOS', 'SpaceLogSpike')
      : path.join(dir, 'SpaceLogSpike');
    if (fs.existsSync(exe)) return exe;
  }
  return null;
}

const exe = process.argv[2] === "--dev" ? null : (process.argv[2] || findPackaged());
const [cmd, args, userDataName] = exe
  ? [exe, [], 'SpaceLogSpike']
  : [require('electron'), [__dirname], 'spacelog-spike-electron'];
const metricsFile = path.join(appData, userDataName, 'spike-metrics.json');
try { fs.rmSync(metricsFile); } catch {}

console.log(`실행: ${cmd}`);
const child = spawn(cmd, args, {
  env: { ...process.env, SPIKE_LAUNCH_EPOCH: String(Date.now()), SPIKE_AUTO_QUIT_SEC: '2' },
  stdio: 'ignore',
});

const deadline = Date.now() + 120_000;
const timer = setInterval(() => {
  let m = null;
  try { m = JSON.parse(fs.readFileSync(metricsFile, 'utf8')); } catch {}
  if (m?.memoryAfter60s || Date.now() > deadline) {
    clearInterval(timer);
    console.log(JSON.stringify({
      mode: exe ? 'packaged' : 'dev', electron: m?.electron, platform: m?.platform,
      startup: m?.startup, shortcut: m?.shortcut, server: m?.server && { port: m.server.port, health: m.server.health?.status },
      memoryAfter60s: m?.memoryAfter60s,
      selftest: m?.selftest, events: m?.events,
    }, null, 2));
    setTimeout(() => { try { child.kill(); } catch {} }, 5000);
  }
}, 500);
