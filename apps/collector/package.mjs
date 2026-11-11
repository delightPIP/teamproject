// 수집 앱 설치 파일 만들기 (이슈 #57): 지금 OS용 zip 한 개를 out/에 만든다.
//   npm run package                 → out/SpaceLog-<버전>-<os>-<arch>.zip (지금 PC의 arch)
//   npm run package -- --arch=x64   → 다른 arch (Apple Silicon 맥에서 Intel용을 만들 때)
// 서명·공증은 하지 않는다 (인증서 없음, PRD 8장). 다른 OS용은 그 OS에서 만든다 —
// 윈도우에서 맥용을 만들면 Electron 프레임워크의 심볼릭 링크가 깨진다. CI(.github/workflows/release.yml)가 맡는다.
import { downloadArtifact } from "@electron/get";
import { packager } from "@electron/packager";
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const out = path.join(here, "out");
const stage = path.join(out, "stage");
const arch = process.argv.find((a) => a.startsWith("--arch="))?.slice("--arch=".length) ?? process.arch;
const pkg = JSON.parse(readFileSync(path.join(here, "package.json"), "utf8"));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
// npm.cmd는 윈도우에서 셸을 거쳐야 실행된다. node·tar·ditto는 셸 없이 (경로의 공백 때문)
// 윈도우 10 이상에 들어 있는 bsdtar. Git Bash의 GNU tar는 zip을 못 다뤄 System32 것을 직접 부른다
const winTar = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: "inherit", shell: cmd === npm && process.platform === "win32" });

// 1) 로컬 웹(web/dist) — 패키지 안 resources/web 으로 실린다. 오래된 빌드가 실리지 않게 매번 새로 만든다
const webDist = path.join(repo, "web/dist");
run(npm, ["run", "build", "-w", "@spacelog/web"], repo);
if (!existsSync(path.join(webDist, "index.html"))) throw new Error("web/dist/index.html이 없습니다");

// 2) 수집 앱 + 로컬 서버 번들 (dist/)
run(process.execPath, ["build.mjs"], here);

rmSync(out, { recursive: true, force: true });
cpSync(webDist, path.join(stage, "web"), { recursive: true }); // extraResource는 폴더 이름 그대로 싣는다

// 3) 묶기. 렌더러·서버 의존성은 esbuild가 dist/에 다 넣었으므로 node_modules는 싣지 않는다
const keep = (p) => p === "" || p === "/package.json" || p === "/dist" || p.startsWith("/dist/");
const [appDir] = await packager({
  dir: here,
  out,
  name: "SpaceLog",
  executableName: "SpaceLog",
  appVersion: pkg.version,
  appBundleId: "com.spacelog.collector", // app.ts의 setAppUserModelId와 같게
  appCopyright: "SpaceLog team",
  platform: process.platform,
  arch,
  asar: true,
  ignore: (p) => !keep(p.replace(/\\/g, "/")),
  extraResource: [path.join(stage, "web")],
  overwrite: true,
  // 맥: 트레이 앱이라 Dock·앱 전환기에 안 뜨게 (app.ts의 app.dock.hide()보다 먼저 적용돼 깜빡임이 없다)
  extendInfo: { LSUIElement: true },
  // 윈도우 exe 리소스(이름·버전·아이콘)는 3-1에서 원본으로 되돌리므로 win32metadata·icon을 주지 않는다
});

// 3-1) 윈도우: 실행 파일을 Electron 공식 electron.exe 원본으로 되돌린다.
// packager는 이름·버전 정보를 exe 리소스에 새로 써 넣는데(resedit), 그러면 파일 해시가 바뀌어 평판이 없는
// 새 파일이 되고 윈도우 앱 제어(스마트 앱 컨트롤)가 막는다. 2026-11-11 이 PC에서 확인: 고친 exe는 막힘,
// 같은 폴더에 원본 electron.exe를 SpaceLog.exe로 두면 실행됨. 서명 인증서가 생기면 이 단계를 지우고 서명한다.
// 대가: 파일 속성의 설명이 "Electron"으로 보이고, exe 아이콘을 바꿀 수 없다.
if (process.platform === "win32") {
  // package.json의 범위(^45…)가 아니라 실제로 설치된 버전 = packager가 쓴 버전
  const electronVersion = JSON.parse(readFileSync(path.join(here, "node_modules/electron/package.json"), "utf8")).version;
  const electronZip = await downloadArtifact({ version: electronVersion, artifactName: "electron", platform: "win32", arch });
  const tmp = path.join(stage, "electron-orig");
  mkdirSync(tmp, { recursive: true });
  run(winTar, ["-x", "-f", electronZip, "-C", tmp, "electron.exe"]);
  copyFileSync(path.join(tmp, "electron.exe"), path.join(appDir, "SpaceLog.exe"));
}

// 3-2) 맥: Info.plist를 고쳐서 Electron의 ad-hoc 서명이 깨졌다. Apple Silicon은 서명이 깨진 앱을
// "손상됨"으로 막으므로 ad-hoc으로 다시 서명한다 (공증은 아님 — 첫 실행은 여전히 우클릭 → 열기)
if (process.platform === "darwin") {
  run("codesign", ["--force", "--deep", "--sign", "-", path.join(appDir, "SpaceLog.app")]);
}

// 4) zip. 맥은 ditto로 묶어야 .app 안의 심볼릭 링크·실행 권한이 보존된다
const zip = path.join(out, `SpaceLog-${pkg.version}-${process.platform === "win32" ? "windows" : process.platform === "darwin" ? "macos" : process.platform}-${arch}.zip`);
if (process.platform === "darwin") {
  run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", path.join(appDir, "SpaceLog.app"), zip]);
} else {
  // 폴더째(SpaceLog-win32-x64/) 넣어 풀면 폴더 하나가 생기게 한다
  run(process.platform === "win32" ? winTar : "bsdtar", ["-a", "-c", "-f", zip, "-C", path.dirname(appDir), path.basename(appDir)]);
}
rmSync(stage, { recursive: true, force: true });
console.log(`설치 파일 → ${path.relative(here, zip)}`);
