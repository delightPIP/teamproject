// 데모·리허설 준비 한 번에 (PO). DEMO 1장 "발표 당일 아침 순서" 2~4번을 대신한다.
//   node scripts/demo-reset.mjs [--at HH:MM] [데모 보관함 경로]
//   node scripts/demo-reset.mjs --restore        ← 끝난 뒤 설정을 데모 전으로 되돌린다
//
// ⚠ 수집 앱을 끈 뒤에 실행한다 (트레이 → 종료). 켜져 있으면 앱이 settings.json을 다시 써서
//   여기서 바꾼 값이 덮어써지고, 서버가 보관함 폴더를 잡고 있어 지우기가 실패할 수 있다.
//
// 하는 일
//   1) 데모 보관함을 지우고 다시 시드한다 (7일 전 별 3개 + 이번 주 20개, 실행 시각 기준)
//   2) 수집 앱 설정이 그 보관함을 보게 하고, 오늘 알림을 다시 받을 수 있게 되돌린다
//      (처음 바꿀 때 원래 설정을 settings.before-demo.json에 남긴다)
//   3) 알림 시각을 넣은 실행 명령을 출력한다. --at이 없으면 지금 + 4분 (DEMO 1장 5번)
//
// 안전장치: 보관함 폴더 이름에 "demo"가 없으면 지우지 않고 멈춘다. 평소 보관함(문서/SpaceLog)은 건드리지 않는다.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userData =
  platform() === "darwin"
    ? path.join(homedir(), "Library", "Application Support", "SpaceLog")
    : path.join(process.env.APPDATA ?? path.join(homedir(), "AppData", "Roaming"), "SpaceLog");
const settingsFile = path.join(userData, "settings.json");
const backupFile = path.join(userData, "settings.before-demo.json");
const NO_SETTINGS = { __noSettingsBeforeDemo: true }; // 데모 전에 settings.json이 없었다는 표시

const fail = (msg) => {
  console.error(`✖ ${msg}`);
  process.exit(1);
};

// ───────── 인자 ─────────
const args = process.argv.slice(2);
let at = null;
let vaultArg = null;
let restore = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--restore") restore = true;
  else if (args[i] === "--at") at = args[++i];
  else vaultArg = args[i];
}

// ───────── 되돌리기 ─────────
if (restore) {
  if (!existsSync(backupFile)) fail(`되돌릴 백업이 없어요: ${backupFile}`);
  const saved = JSON.parse(readFileSync(backupFile, "utf8"));
  if (saved.__noSettingsBeforeDemo) rmSync(settingsFile, { force: true });
  else copyFileSync(backupFile, settingsFile);
  rmSync(backupFile);
  console.log(`설정을 데모 전으로 되돌렸어요: ${settingsFile}`);
  console.log("데모 보관함 폴더는 남겨 두었어요. 필요 없으면 직접 지우세요.");
  process.exit(0);
}

if (at !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(at)) fail(`--at은 HH:MM 형식이어야 해요 (받은 값: ${at})`);

const vault = path.resolve(vaultArg ?? path.join(homedir(), "Documents", "SpaceLog-demo"));
if (!/demo/i.test(path.basename(vault))) {
  fail(`폴더 이름에 "demo"가 없어 지우지 않았어요: ${vault}\n  평소 보관함을 지우는 사고를 막기 위한 확인입니다. 데모용 폴더 이름에 demo를 넣어 주세요.`);
}

// ───────── 1) 보관함 비우고 시드 ─────────
console.log(`데모 보관함: ${vault}`);
try {
  rmSync(vault, { recursive: true, force: true });
} catch (e) {
  fail(`보관함을 지우지 못했어요 (${e.code ?? e.message}). 수집 앱을 끄고(트레이 → 종료) 다시 실행하세요.`);
}
execFileSync(process.execPath, [path.join(repo, "apps/server/vault/seed.ts"), vault], { stdio: "inherit" });

// ───────── 2) 설정 ─────────
let settings = {};
if (existsSync(settingsFile)) {
  try {
    settings = JSON.parse(readFileSync(settingsFile, "utf8"));
  } catch {
    console.warn("기존 settings.json을 읽지 못해 새로 씁니다");
  }
}
mkdirSync(userData, { recursive: true });
// 처음 한 번만 원래 설정을 남긴다. 리허설을 여러 번 돌려도 --restore는 데모 전 설정으로 돌아간다
if (!existsSync(backupFile)) {
  if (existsSync(settingsFile)) copyFileSync(settingsFile, backupFile);
  else writeFileSync(backupFile, JSON.stringify(NO_SETTINGS), "utf8");
}
const next = {
  ...settings,
  vaultPath: vault,
  lastNotifiedLocalDate: null, // 오늘 알림을 다시 받는다
  launchAtLogin: false, // 리허설 중에 로그인 자동 실행을 등록하지 않는다 (--restore로 원래 값으로)
  onboardingDone: true,
};
writeFileSync(settingsFile, JSON.stringify(next, null, 2), "utf8");
console.log(`설정: ${settingsFile} → 데모 보관함을 보게 했어요 (알림 다시 받기 켬)`);
console.log(`원래 설정: ${backupFile} (끝나면 node scripts/demo-reset.mjs --restore)`);

if (!existsSync(path.join(repo, "web/dist/index.html"))) {
  console.log('\n⚠ web/dist가 없어요. 우주 화면을 띄우려면 먼저: npm install; npm run build -w @spacelog/web');
}

// ───────── 3) 실행 명령 ─────────
if (at === null) {
  const t = new Date(Date.now() + 4 * 60_000);
  if (t.getSeconds() > 0) t.setMinutes(t.getMinutes() + 1); // 올림: 최소 4분 뒤
  at = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
}
console.log(`\n이제 수집 앱을 띄우세요. 알림 시각 ${at} (알림은 1분마다 확인해서 최대 1분 늦게 뜰 수 있어요)`);
if (platform() === "win32") {
  console.log(`  PowerShell:  cd apps/collector; $env:SPACELOG_NOTIFY_AT="${at}"; npm start`);
} else {
  console.log(`  cd apps/collector && SPACELOG_NOTIFY_AT=${at} npm start`);
}
