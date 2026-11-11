import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// 개발 중 /api 는 로컬 서버로 넘긴다. `npm run dev:mock` 이면 목업을 쓰므로 넘기지 않는다.
// changeOrigin: Host 를 서버 주소로 바꿔 서버의 Host 검사를 통과한다 (POLICY 1-3). Origin 은 그대로라 서버에 SPACELOG_DEV_ORIGIN 이 필요하다
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    base: "./",
    plugins: [react()],
    server: env.API_TARGET ? { proxy: { "/api": { target: env.API_TARGET, changeOrigin: true } } } : undefined,
  };
});
