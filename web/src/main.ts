// 진입점: 토큰 처리 → 라우터 → 초기 로드 (SPEC 3-3)
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { getToken, saveToken, setApiListeners, setMock } from "./api/client";
import { App } from "./App";
import { parseHash, takeToken } from "./router";
import { store } from "./state/store";
import "./styles/tokens.css";
import "./styles/app.css";
import "./ui/ui.css";

const s = store.getState();

// 1. 주소의 토큰 → sessionStorage, 주소창에서는 지운다
const { token, cleanSearch, cleanHash } = takeToken(location.search, location.hash);
if (token) saveToken(token);
history.replaceState(null, "", `${location.pathname}${cleanSearch}${cleanHash}`);

if (import.meta.env.VITE_API_MOCK === "1") {
  setMock((await import("./api/mock")).mockApi); // 배포 빌드에는 들어가지 않는다
}

setApiListeners({
  onConnection: (c) => store.getState().setConnection(c),
  onUnauthorized: () => store.getState().setAuth("required"),
});

// 2. 해시 라우팅. 새로고침해도 같은 화면으로 돌아온다
s.applyRoute(parseHash(location.hash).route);
window.addEventListener("hashchange", () => store.getState().applyRoute(parseHash(location.hash).route));

createRoot(document.getElementById("root")!).render(createElement(App));

// 3. 토큰이 있으면 초기 로드, 끝나면 창 포커스마다 다시 받기 (POLICY 1-5)
if (!getToken()) {
  s.setAuth("required");
} else {
  s.setAuth("ok");
  s.loadInitial().then(() => {
    window.addEventListener("focus", () => {
      if (store.getState().auth === "ok") void store.getState().refresh();
    });
  });
}
