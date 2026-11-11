# D21 실습 → SpaceLog 적용 정리

> D21 워크북 "Flask ② — 폼 · DB · 배포"(2026-11-11)의 실습 항목이 SpaceLog 어디에 들어갔는지 정리한 문서다.
> 기준: `main` d382cdf (PR #61 머지 직후).
> 작성자 실행 (2026-11-11, Node 24.21.0): `node --test "apps/server/**/*.test.ts"` → tests 71 · pass 71 · fail 0.
> 작성자 검색: `grep -rn "dangerouslySetInnerHTML\|innerHTML" web/src` → 0건.

SpaceLog는 Flask가 아니라 **Node(TypeScript) 로컬 서버 + React 웹 + Electron 수집 앱**이다. 그래서 D21 코드를 그대로 옮긴 곳은 없고, **같은 원칙을 다른 기술로 적용**했다.

| D21 | SpaceLog |
| --- | --- |
| Flask `@app.route` | `apps/server/app.ts`의 `"METHOD /path"` → 핸들러 Map |
| HTML `<form method="post">` | 수집 앱·웹이 보내는 JSON / multipart 요청 |
| `reviews.db` (sqlite3) | 보관함 DB (`node:sqlite`, Node 24 내장) |
| `validate.py` | 라우트 안 본문 검사 + `RouteError` |
| pytest + Flask test client | `node --test`. 일부(`server.test.ts` · `routes/stars.test.ts`)는 실제 서버를 띄워 요청하고, 나머지는 함수를 직접 부른다 |

---

## 1. GET · POST — 엽서와 봉투

D21의 비유: **엽서(GET)** 는 보여 주기만 하고 서버 값을 바꾸지 않는다. **봉투(POST·PATCH)** 는 몸통에 값을 담아 보내고, 저장·변경하거나 큰 본문을 보낼 때 쓴다.
SpaceLog는 이 원칙을 대부분 따르지만, 예외가 하나 있다 (아래 "D21과 다른 점").

서버 API 전체 (`apps/server/app.ts:16`, `apps/server/index.ts:24-29`). `/api/health`를 뺀 나머지는 보관함 경로(`config.vaultDir`)가 있을 때만 붙는다.

| 메서드 · 경로 | 하는 일 | D21 분류 | 정의 |
| --- | --- | --- | --- |
| `GET /api/health` | 서버 살아 있는지 | 엽서 | `apps/server/app.ts:16` |
| `GET /api/universe?from=&to=` | 기간 안의 별·행성 조회 | 엽서 | `apps/server/routes/universe.ts:41` |
| `GET /api/stars/:id` | 별 하나 조회, 없으면 404 | 엽서 | `apps/server/routes/stars.ts:106` |
| `GET /api/rediscovery/today` | 오늘의 재발견 별 (그날 처음 부를 때 고른 결과를 저장) | 엽서, **단 예외** | `apps/server/routes/rediscovery.ts:68` |
| **`POST /api/stars`** | 기록 넣기 (파일 최대 20개 · 텍스트 · 링크) | 봉투 (저장) | `apps/server/routes/stars.ts:104` |
| **`PATCH /api/stars`** | 넣은 직후 확인 카드의 행성·메모 일괄 수정 | 봉투 (변경) | `apps/server/routes/stars.ts:105` |
| **`POST /api/rediscovery/events`** | 재발견 알림 반응 기록 | 봉투 (저장) | `apps/server/routes/rediscovery.ts:69` |
| **`POST /api/export`** | 고른 기록으로 내보내기 글 만들기 (저장은 안 함) | 봉투 (고른 항목 최대 500개를 몸통에 담음) | `apps/server/routes/export.ts:49` |

정적 화면 파일은 GET·HEAD로만 내준다 (`apps/server/app.ts:78`).

**보내는 쪽** (D21의 폼 자리)

| 누가 | 요청 | 위치 |
| --- | --- | --- |
| 수집 앱 | `POST /api/stars` | `apps/collector/main/ingest.ts:122` |
| 수집 앱 | `PATCH /api/stars` | `apps/collector/main/ingest.ts:115` |
| 수집 앱 | `POST /api/rediscovery/events` | `apps/collector/main/notifier.ts:76` |
| 웹 | `POST /api/export` | `web/src/api/client.ts:108` |
| 웹 | `POST /api/rediscovery/events` | `web/src/api/client.ts:112` |

**D21과 다른 점**
- **GET이 값을 저장하는 곳이 하나 있다.** `GET /api/rediscovery/today`는 그날 처음 불릴 때 고른 별을 DB에 저장한다 (`rediscovery.ts:42-46`, `repo.savePick`). 같은 날 다시 불러도 같은 별이 나오게 하려는 것이고, 몇 번 불러도 결과는 같다.
- 허용하지 않는 메서드는 **405가 아니라 404**로 답한다. 근거 테스트 `apps/server/server.test.ts:174`는 테스트용 라우트에 DELETE를 보낸 것이고, 실제 라우트마다 확인한 것은 아니다.
- 폼 제출이 아니라 JSON 응답을 화면에 반영하므로 **PRG(redirect)·flash가 없다**. 안내는 웹의 Toast(`web/src/ui/Toast.tsx`)가 맡는다.
- **DELETE 라우트는 없다.** D21 ★★★ "수정·삭제" 중 수정(PATCH)만 있다.

## 2. SQLite 저장 · `?` 자리표시자

- 보관함 DB: `apps/server/vault/db.ts` (`node:sqlite`의 `DatabaseSync`).
- 사용자 값이 들어가는 쿼리는 모두 `db.prepare(...)`로 만들고 값은 `?` 또는 `:이름` 자리에 넣는다. 예: `SELECT * FROM stars WHERE id = ?` (`db.ts:175`).
- `UPDATE`는 바꿀 **칸 이름**만 코드에서 고르고(사용자 값 아님), 값은 `:이름` 자리에 넣는다 (`db.ts:210-215`).
- DB가 파일이라 껐다 켜도 남는다. 테스트(`apps/server/vault/db.test.ts:25`)는 "다시 열어도 기본 행성이 늘지 않는다"까지만 확인하고, **별이 다시 열어도 남는지는 테스트로 고정되어 있지 않다.**

## 3. 서버 검증 → 400

D21의 "브라우저 검사는 안내판, 서버 검사가 문지기"에 해당한다.

| 검사 | 규칙 | 틀리면 | 위치 |
| --- | --- | --- | --- |
| 본문 공통 | JSON이 아님 · 비었음 · 너무 큼 | 400 `INVALID_REQUEST` | `apps/server/http/body.ts` |
| 기록 넣기 (파일) | multipart 형식 · `files` 있음 · 업로드 크기 상한 | 400 | `apps/server/routes/stars.ts:22-54` |
| 기록 넣기 (텍스트·링크) | `{ kind: "text", text }` 또는 `{ kind: "link", url }`, url은 http(s)만 | 400 | `apps/server/routes/stars.ts:63-68` |
| 기록 넣기 (일부 실패) | 빈 텍스트 · 21번째 파일부터 | **200** + `rejected` 목록 (`TEXT_EMPTY` · `TOO_MANY_FILES`). 나머지는 저장 | `routes/stars.test.ts:68-73`, `:85-86` |
| 확인 카드 | `ids` 1~100개 문자열 · `memo` 140자 이하 | 400 | `apps/server/routes/stars.ts:72-86` |
| 확인 카드 | 없는 행성 · 없는 별 | 404 | `apps/server/routes/stars.ts:87-90` |
| 내보내기 | 형식 · 항목 · 기간 · 개수(500개 상한) | 400 | `apps/server/routes/export.ts` |
| 재발견 이벤트 | `starId` 있음 · `channel` · `type`이 정해진 값 | 400 / 없는 별은 404 | `apps/server/routes/rediscovery.ts:54-62`, `:71` |
| 기간 조회 | `from` · `to`가 날짜(YYYY-MM-DD) | 400 | `apps/server/routes/universe.ts:20-24` |

**D21과 다른 점:** D21은 실패할 때 "입력값을 남긴 화면"을 다시 그리지만, SpaceLog는 오류 코드만 돌려주고 입력값은 수집 앱 화면이 들고 있다.

## 4. 상태 코드 · 상태 화면

| 코드 | 언제 | 근거 |
| --- | --- | --- |
| 200 | 성공. 기록 넣기는 일부만 실패해도 200이고 실패한 것은 `rejected`에 담긴다 | 각 라우트, `routes/stars.test.ts:68-73` |
| 400 | 본문이 틀림 | `server.test.ts:184`, `routes/stars.test.ts:141` |
| 401 | 세션 토큰이 없거나 틀림 | `server.test.ts:50` |
| 403 | 다른 Host · 다른 Origin | `server.test.ts:59`, `:66` |
| 404 | 없는 API · 없는 별 · 다른 메서드 | `server.test.ts:84`, `:174`, `routes/stars.test.ts:103` |
| 500 | 예상 못 한 실패 (본문 없음, 웹은 `UNKNOWN`으로 처리) | `apps/server/app.ts:87-88` |

화면 쪽: 빈 상태·예외 정리는 `docs/SPEC.md` 4장, 빈 우주 화면은 `web/src/home/EmptyState.tsx`, 오류 데이터 계약은 `mocks/api/errors.json` · `mocks/api/universe.empty.json`.

## 5. 비밀 값 · XSS

- `.env*`는 커밋하지 않고 `.env.example`만 허용한다 (`.gitignore:14-16`, POLICY 1-2).
- D21의 `SECRET_KEY` 대신 **실행할 때마다 만드는 세션 토큰**을 쓰고, 비교는 `timingSafeEqual`로 한다 (`apps/server/security.ts`).
- `<script>` 같은 값은 React가 글자로 보여 준다. `dangerouslySetInnerHTML` 사용처는 0건이다 (`web/src`, `main` 기준 검색).

## 6. 배포 (Render)

- `render.yaml`: **"받는 곳" 안내 페이지(`site/`) 하나만** 정적 사이트로 올린다. 기록·보관함·서버는 어디에도 올리지 않는다 (POLICY 1-1·1-3).
- 그래서 D21의 무료 배포 한계(잠들기 · 임시 디스크에서 DB가 지워짐)가 SpaceLog 데이터에는 해당하지 않는다.
- 실제 배포 주소가 살아 있는지는 이 문서에서 **확인하지 않았다**.

## 7. 하지 않은 것 · 확인 못 한 것

| D21 항목 | 상태 |
| --- | --- |
| PRG + flash · 세션 찜하기 | 해당 없음 (JSON API + SPA 구조) |
| 공격 표 10개 (`검증규칙_양식.md`) | 저장소에 셀프 공격 기록이 없다. 일부 경우(빈 값 · 너무 긺 · 형식 틀림)만 테스트로 고정되어 있다 |
| Claude Design 접근성 검토 기록 | `docs/DESIGN.md` · `docs/SPEC.md`에서 "접근성" 섹션을 찾지 못했다 |
| 삭제(DELETE) · 행성 관리 | 라우트 없음. SPEC 0장은 웹 → 서버를 "조회·수정·삭제·내보내기 API"로 그리지만, 현재 서버에는 행성 이름 변경·생성·삭제·합치기, 별 삭제 라우트가 없다 |
| 별이 껐다 켜도 남는지 | 테스트로 고정되지 않음 (2장) |
| Render 배포 주소 확인 | 미확인 |
