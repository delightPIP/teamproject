// 수집 앱 빌드: main·preload·드롭존·설정 화면, 그리고 로컬 서버(apps/server)를 dist/로 묶는다.
// 서버를 묶는 이유: Electron 내장 Node가 .ts를 직접 실행한다는 보장이 없고, @spacelog/shared를
// 워크스페이스 설치 없이 찾게 하려면 번들이 가장 확실하다 (서버 코드는 그대로, 묶기만 한다).
import { build } from "esbuild";
import { cpSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const out = path.join(here, "dist");
mkdirSync(out, { recursive: true });

const alias = { "@spacelog/shared": path.join(repo, "packages/shared") };
// "@spacelog/shared/errors" → packages/shared/errors.ts
const sharedPlugin = {
  name: "shared",
  setup(b) {
    b.onResolve({ filter: /^@spacelog\/shared\// }, (args) => ({
      path: path.join(alias["@spacelog/shared"], `${args.path.split("/").pop()}.ts`),
    }));
  },
};

const common = { bundle: true, sourcemap: "inline", logLevel: "warning", plugins: [sharedPlugin] };

await Promise.all([
  build({ ...common, entryPoints: [path.join(here, "main/app.ts")], outfile: path.join(out, "main.cjs"), platform: "node", format: "cjs", target: "node22", external: ["electron"] }),
  build({ ...common, entryPoints: [path.join(here, "main/preload.ts")], outfile: path.join(out, "preload.cjs"), platform: "node", format: "cjs", target: "node22", external: ["electron"] }),
  build({ ...common, entryPoints: [path.join(here, "dropzone/index.tsx")], outfile: path.join(out, "dropzone.js"), platform: "browser", format: "iife", target: "chrome130", jsx: "automatic" }),
  build({ ...common, entryPoints: [path.join(here, "settings/index.tsx")], outfile: path.join(out, "settings.js"), platform: "browser", format: "iife", target: "chrome130", jsx: "automatic" }),
  // 서버는 top-level await를 쓰므로 ESM(.mjs). utilityProcess가 ESM 진입점을 받는다
  build({ ...common, entryPoints: [path.join(repo, "apps/server/index.ts")], outfile: path.join(out, "server.mjs"), platform: "node", format: "esm", target: "node22" }),
]);

for (const f of ["dropzone/dropzone.html", "dropzone/dropzone.css", "settings/settings.html"]) {
  cpSync(path.join(here, f), path.join(out, path.basename(f)));
}
console.log("collector build → dist/");
