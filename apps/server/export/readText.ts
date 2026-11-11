// .txt·.md 원본 본문 읽기 (POLICY 2-8). ExportRepo.readFileText 구현에 쓴다.
// 보관함 안의 상대 경로만 읽고, 앞부분만 읽어 큰 파일도 빠르게 처리한다.
import { closeSync, openSync, readSync } from "node:fs";
import { resolve, sep } from "node:path";
import { FILE_TEXT_LIMIT } from "./collect.ts";

/** UTF-8 한 글자는 최대 4바이트. 자르기 표시를 판단하도록 한 글자 더 읽는다 */
const MAX_BYTES = (FILE_TEXT_LIMIT + 1) * 4;

/** 보관함 기준 상대 경로 → 절대 경로. 보관함 밖이면 null */
export function vaultFilePath(vaultDir: string, storagePath: string): string | null {
  if (!storagePath || storagePath.includes("\0")) return null;
  const root = resolve(vaultDir);
  const file = resolve(root, storagePath);
  return file.startsWith(root + sep) ? file : null;
}

/** 앞부분을 UTF-8로 읽는다. 없거나 못 읽으면 null. 자르기는 collect.ts가 한다 */
export function readTextHead(vaultDir: string, storagePath: string | null): string | null {
  const file = storagePath ? vaultFilePath(vaultDir, storagePath) : null;
  if (!file) return null;
  let fd: number | null = null;
  try {
    fd = openSync(file, "r");
    const buf = Buffer.alloc(MAX_BYTES);
    const n = readSync(fd, buf, 0, MAX_BYTES, 0);
    // 끝에서 잘린 멀티바이트 글자는 TextDecoder가 버리지 않고 �로 바꾸므로 stream 모드로 버린다
    return new TextDecoder("utf-8").decode(buf.subarray(0, n), { stream: true });
  } catch {
    return null;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}
