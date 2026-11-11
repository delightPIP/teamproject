# 로컬 웹

우주 홈, 행성 패널, 별 상세, 탐사선 화면. React(2D) + Three.js(3D) + Vite + TypeScript, 상태는 Zustand ([ADR 0002](../docs/adr/0002-web-stack.md), 제안 단계). 타입·오류 코드·기간 계산은 `@spacelog/shared`를 쓴다.

## 실행

```bash
npm install         # 저장소 루트에서 (npm workspaces)
cd web
npm run dev:mock    # mocks/api JSON으로 실행
```

브라우저에서 `http://localhost:5173/#/?token=dev` 를 연다. 토큰이 없으면 "수집 앱의 [우주 보기]로 다시 열어 주세요" 화면이 나온다. 목업 모드에서는 토큰 값이 무엇이든 통과한다. 기록 0건 우주는 `#/?token=dev&mock=empty`.

### 세 가지 띄우는 법 (#34)

| 언제 | 서버 | 웹 | 브라우저 주소 |
| --- | --- | --- | --- |
| **목업** (서버 없이) | 없음 | `cd web && npm run dev:mock` | `http://localhost:5173/#/?token=dev` |
| **실서버 + 개발 서버** | `SPACELOG_TOKEN=dev SPACELOG_DEV_ORIGIN=http://localhost:5173 node apps/server/index.ts` | `web/.env`에 `API_TARGET=http://127.0.0.1:47800` → `cd web && npm run dev` | `http://localhost:5173/#/?token=dev` |
| **데모·제품** (서버가 웹을 내려줌) | `npm run build -w web` 후 `SPACELOG_TOKEN=dev SPACELOG_WEB_DIR=web/dist node apps/server/index.ts` | 없음 | `http://127.0.0.1:47800/#/?token=dev` |

- 서버 명령은 저장소 루트에서 실행한다. 포트가 사용 중이면 서버가 다음 포트를 쓰니 `{"type":"listening","port":…}` 출력의 포트를 쓴다.
- 실서버 + 개발 서버에서는 `SPACELOG_DEV_ORIGIN`을 웹 개발 서버 주소와 **정확히** 맞춘다. 다르면 POST 요청이 403으로 막힌다. Host 는 Vite proxy(`changeOrigin`)가 서버 주소로 바꿔 준다.
- `?token=` 값은 서버의 `SPACELOG_TOKEN`과 같아야 한다. 수집 앱으로 열면 수집 앱이 넣어 준다.
- 서버 2/4(#33) 전에는 `/api/universe`가 404라 우주가 비어 보인다. 그때는 목업으로 띄운다.

### 데모 PC 확인 (DEMO 1장, 개발 C)

- [ ] 기본 브라우저에 다른 탭 없이 연다
- [ ] WebGL: 3D 우주가 보인다 (안 되면 "이 브라우저에서는 3D 우주를 볼 수 없어요" 배너와 행성 목록만 나온다)
- [ ] 조작 없이 행성이 모두 보인다 (AC-우주-1)
- [ ] 왼쪽 목록에서 행성 1번 클릭 → 자동 비행 → 패널 (AC-우주-3, 클릭 2회 이내)
- [ ] 오른쪽 아래 재발견 카드 [보러 가기] → 별 상세 (#35, 데모 4~5분)

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
