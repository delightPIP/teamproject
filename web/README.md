# 로컬 웹

우주 홈, 행성 패널, 별 상세, 탐사선 화면. React(2D) + Three.js(3D) + Vite + TypeScript, 상태는 Zustand ([ADR 0002](../docs/adr/0002-web-stack.md), 제안 단계). 타입·오류 코드·기간 계산은 `@spacelog/shared`를 쓴다.

## 실행

```bash
npm install         # 저장소 루트에서 (npm workspaces)
cd web
npm run dev:mock    # mocks/api JSON으로 실행
```

브라우저에서 `http://localhost:5173/#/?token=dev` 를 연다. 토큰이 없으면 "수집 앱의 [우주 보기]로 다시 열어 주세요" 화면이 나온다. 목업 모드에서는 토큰 값이 무엇이든 통과한다. 기록 0건 우주는 `#/?token=dev&mock=empty`.

실제 서버에 붙일 때는 `.env.example`을 `.env`로 복사하고 `API_TARGET`에 서버 주소를 넣은 뒤 `npm run dev`.

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev:mock` | 목업 API로 개발 서버 실행 |
| `npm run dev` | `/api`를 `API_TARGET`으로 넘겨 실행 |
| `npm test` | 라우터·스토어·API 클라이언트 테스트 (`node:test`, 루트 `npm test`에도 포함) |
| `npm run build` | 타입 검사 후 `dist/`로 빌드 |

## 화면 계약 (`src/state/store.ts`)

화면끼리는 스토어 함수로만 서로를 부른다 (SPEC 2-5). React 화면은 `useStore(s => s.값)`, 3D 코드는 `store.getState()`를 쓴다.

| 함수 | 하는 일 |
| --- | --- |
| `flyToPlanet(id, "openPanel")` | 3D가 등록한 자동 비행 후 패널 열기. 3D가 없으면 바로 패널 |
| `openPanel(id)` / `openStar(id)` | 패널·상세 열기, URL `#/planet/:id` · `#/star/:id`. 기간 밖 별은 서버에서 행성을 찾는다 |
| `closePanel()` / `returnToOverview()` | 패널 닫기 / 카메라 조망 |
| `addToCargo(item)` / `removeFromCargo(i)` | 탐사선 싣기·빼기. 같은 항목이면 넣지 않고 `false` |
| `setPeriod(period)` | 기간 바꾸고 다시 받기 |

**합의가 필요한 추가 함수**

| 함수 | 누가 부르나 | 하는 일 |
| --- | --- | --- |
| `starsDeleted(ids)` · `planetDeleted(id)` · `planetMerged(from, to)` | 개발 B, 삭제·합치기 API 성공 뒤 | 목록·탐사선·선택 상태 정리 (SPEC 3-7) |
| `registerFlyToPlanet(fn)` · `setCamera(c)` | 개발 C (3D) | 자동 비행 구현 등록, 카메라 상태 알림 |
| `goBack()` | `Esc` | 탐사선 → 상세 → 패널 → 조망 순서로 한 단계 뒤로 |
| `showToast(문구, 종류)` | 전체 | 4초 토스트 |

`App.tsx`의 "자리 표시" 컴포넌트는 각자 화면이 나오면 바꿔 끼운다: 행성 패널·별 상세(#5), 탐사선(#8), 우주 홈(#3).

## 임시로 둔 것

- `src/styles/tokens.css`: 값은 임시. 디자이너 1(#9)이 바꾼다.
- `src/ui/KindIcon.tsx`: 이모지 아이콘. 디자이너 아이콘이 나오면 바꾼다.
