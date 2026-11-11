import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// 개발 중 /api 는 로컬 서버로 넘긴다. `npm run dev:mock` 이면 목업을 쓰므로 넘기지 않는다.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    base: "./",
    plugins: [react()],
    server: env.API_TARGET ? { proxy: { "/api": env.API_TARGET } } : undefined,
  };
});
