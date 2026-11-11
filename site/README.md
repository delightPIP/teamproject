# site — SpaceLog 받는 곳 (Render에 올리는 유일한 것)

수집 앱을 **받고 설치하는 방법만** 안내하는 정적 페이지 한 장이다. 빌드 도구가 없다. `index.html` + `styles.css`가 전부다.

## 왜 이것만 올리나

SpaceLog는 기록이 내 PC에만 있는 제품이다 (PRD 3장, [POLICY](../docs/POLICY.md) 1-1·1-3: 로컬 서버는 `127.0.0.1`에만 바인딩). 그래서 **보관함·로컬 서버·로컬 웹은 호스팅하지 않는다.** 올리면 제품의 전제가 깨진다.

| 어디서 도나 | 무엇 |
| --- | --- |
| Render (공개) | 이 폴더 — 받는 곳 안내 한 장. 사용자 데이터 없음 |
| 사용자 PC | 수집 앱, 로컬 서버, 로컬 웹(`web/dist`), 보관함 |

## 디자인

[docs/DESIGN.md](../docs/DESIGN.md) 3장 토큰을 그대로 쓴다 — 컬러(`--ink` `--space` `--panel` `--yellow` `--violet` …), 타이포(Black Han Sans / Pretendard / IBM Plex Mono), 모양(3px 잉크 테두리, 흐리지 않은 단색 드롭 섀도, 16px 카드 모서리), 760px에서 1단으로 바뀌는 배치(12장).

한 가지만 다르다: **서체를 CDN에서 불러온다.** DESIGN 3-2는 "로컬 웹은 인터넷 없이도 열려야 하므로 woff2를 로컬 서버에 같이 넣는다"고 정했는데, 이 페이지는 로컬 웹이 아니라 공개 웹사이트라 그 조건이 적용되지 않는다. 로컬 웹(`web/`)은 지금처럼 `@fontsource` 패키지를 쓴다.

## 로컬에서 보기

브라우저로 `site/index.html`을 바로 열면 된다. 서버가 필요 없다.

## Render 설정

[`render.yaml`](../render.yaml)에 있다. 대시보드에서 직접 만들 경우:

| 항목 | 값 |
| --- | --- |
| Type | Static Site |
| Root Directory | `site` |
| Build Command | 비움 |
| Publish Directory | `.` |

## 릴리스가 나오면 고칠 곳

`index.html`의 `#받기` 섹션에 Windows·macOS 줄이 **`준비 중`** 상태로 있다. GitHub Releases에 파일이 올라가면 그 줄을 링크로 바꾸고 `pill soon` → `pill ready`로 바꾼다. 히어로 아래 "설치 파일은 준비 중입니다" 문장도 함께 지운다.

서명하지 않은 빌드를 올리는 동안에는 `#막힐때` 섹션(SmartScreen·Gatekeeper 안내)을 지우지 않는다. 스파이크에서 서명 없는 실행 파일이 실제로 윈도우 앱 제어 정책에 막혔다 ([ADR 0001](../docs/adr/0001-collector-server-stack.md) 4-1, PRD 8장).
