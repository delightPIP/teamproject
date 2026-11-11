// 데모·리허설 준비 한 번에 (PO).
//   node scripts/demo-reset.mjs
//
// 하는 일
//   1) 데모 보관함을 지우고 다시 시드한다 (7일 전 별 3개 + 이번 주 20개, DEMO 1장 사전 준비)
//   2) 수집 앱 설정이 그 보관함을 보게 하고, 오늘 알림을 다시 받을 수 있게 되돌린다
//
// 왜 필요한가
//   - 시드는 이미 별이 있는 보관함에는 넣지 않는다. 리허설을 두 번 하려면 매번 비워야 한다
//   - 재발견 알림은 하루 1번이라, 두 번째 리허설에서는 lastNotifiedLocalDate를 비워야 다시 뜬다
//
// 평소 보관함(문서/SpaceLog)은 건드리지 않는다. 데모용 폴더만 지운다.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vault = process.argv[2] ?? path.join(homedir(), "Documents", "SpaceLog-demo");
const userData =
  platform() === "darwin"
    ? path.join(homedir(), "Library", "Application Support", "SpaceLog")
    : path.join(process.env.APPDATA ?? path.join(homedir(), "AppData", "Roaming"), "SpaceLog");
const settingsFile = path.join(userData, "settings.json");

console.log(`보관함: ${vault}`);
rmSync(vault, { recursive: true, force: true });
execFileSync(process.execPath, [path.join(repo, "apps/server/vault/seed.ts"), vault], { stdio: "inherit" });

let settings = {};
if (existsSync(settingsFile)) {
  try {
    settings = JSON.parse(readFileSync(settingsFile, "utf8"));
  } catch {
    console.warn("기존 settings.json을 읽지 못해 새로 씁니다");
  }
}
const next = {
  ...settings,
  vaultPath: vault,
  lastNotifiedLocalDate: null, // 오늘 알림을 다시 받는다
  launchAtLogin: false, // 리허설 중에 로그인 자동 실행을 등록하지 않는다
  onboardingDone: true,
};
mkdirSync(userData, { recursive: true });
writeFileSync(settingsFile, JSON.stringify(next, null, 2), "utf8");
console.log(`설정: ${settingsFile} → 데모 보관함을 보게 했어요 (알림 다시 받기 켬)`);

if (!existsSync(path.join(repo, "web/dist/index.html"))) {
  console.log('\n⚠ web/dist가 없어요. 우주 화면을 띄우려면 먼저: npm install && npm run build -w @spacelog/web');
}

const at = new Date(Date.now() + 3 * 60_000);
const hhmm = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
console.log(`\n이제 수집 앱을 띄우세요 (알림이 약 3분 뒤 ${hhmm}에 뜹니다):`);
console.log(`  cd apps/collector && SPACELOG_NOTIFY_AT=${hhmm} npm start`);
console.log("\n끝나고 평소 보관함으로 돌아가려면: 설정 창에서 보관함 위치를 문서/SpaceLog로 바꾸면 됩니다.");
