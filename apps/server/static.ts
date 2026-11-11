// 웹 빌드 결과(web/dist)를 정적 파일로 내려준다 (ADR 0002 5-1).
// 해시 라우팅이라 index.html로 돌려주는 처리는 없다. 없는 파일은 404.
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { extname, resolve, sep } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

/** URL 경로 → webDir 안의 파일 경로. 밖으로 나가거나 이상한 경로면 null */
export function resolveStaticPath(webDir: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const root = resolve(webDir);
  const file = resolve(root, "." + (decoded === "/" ? "/index.html" : decoded));
  return file.startsWith(root + sep) ? file : null;
}

/** 내려줬으면 true, 파일이 없으면 false */
export async function serveStatic(webDir: string, urlPath: string, method: string, res: ServerResponse): Promise<boolean> {
  const file = resolveStaticPath(webDir, urlPath);
  if (!file) return false;
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) return false;

  // Vite 빌드 파일은 이름에 해시가 붙어 오래 캐시해도 된다. index.html 등은 매번 확인
  const hashed = urlPath.startsWith("/assets/");
  res.writeHead(200, {
    "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
    "content-length": info.size,
    "cache-control": hashed ? "public, max-age=31536000, immutable" : "no-cache",
  });
  if (method === "HEAD") {
    res.end();
    return true;
  }
  // 읽는 도중 실패(파일 삭제 등)해도 서버가 죽지 않게 연결만 끊는다
  createReadStream(file).on("error", () => res.destroy()).pipe(res);
  return true;
}
