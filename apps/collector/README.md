# 수집 앱 (PO, 이슈 #6)

Electron + TypeScript (ADR 0001). 드롭존 창, 트레이, 전역 단축키, 넣은 직후 확인 카드, 재발견 알림, 로컬 서버 실행·재시작을 맡는다.
**오늘(2026-11-11) 데모는 개발 모드로 띄운다.** 설치 파일(zip)은 이슈 #57에서 만들었다 — 아래 "설치 파일 만들기".

## 실행

```bash
cd apps/collector
npm install
npm start            # 빌드(dist/) 후 Electron 실행
```

로컬 웹을 같이 띄우려면 먼저 `web`을 빌드해 둔다 (`web/dist`가 있으면 서버가 정적 파일로 내려준다).

| 환경 변수 (개발용. `SPACELOG_GPU`만 배포 빌드에서도 읽는다) | 뜻 |
| --- | --- |
| `SPACELOG_NOTIFY_AT="HH:MM"` | 재발견 알림 시각 덮어쓰기 (SPEC 1-2, DEMO 1장). 기본 15:00 |
| `SPACELOG_SERVER_ENTRY=dev/mockServer.mjs` | 실제 서버 대신 가짜 서버(메모리 저장)로 띄운다. 서버 2/4(#33) 머지 전 확인용 |
| `SPACELOG_WEB_URL=http://localhost:5173` | [우주 보기]를 Vite 개발 서버로 연다. `web/.env.local`의 `API_TARGET`이 수집 앱 서버 포트(로그의 `서버 ok :포트`)와 같아야 한다 |
| `SPACELOG_SELFTEST=1` (+ `SPACELOG_SELFTEST_QUIT=1`) | 자가검증을 돌리고 결과를 로그와 측정 파일에 남긴다. **클립보드를 덮어쓴다** |
| `SPACELOG_GPU=1` | GPU 가속을 켠다 (기본은 끔: 스파이크에서 private 메모리 174→113MB) |

측정·자가검증 결과는 `%APPDATA%\SpaceLog\collector-metrics.jsonl` (맥 `~/Library/Application Support/SpaceLog/`)에 한 줄씩 쌓인다.
설정은 같은 폴더의 `settings.json`. 보관함 기본 위치는 `문서/SpaceLog`.

## 설치 파일 만들기 (이슈 #57)

```bash
cd apps/collector
npm install
npm run package                 # 지금 OS·arch용 → out/SpaceLog-0.1.0-windows-x64.zip
npm run package -- --arch=x64   # 맥에서 Intel용
```

`package.mjs`가 하는 일: `web/dist`가 없으면 웹 빌드 → `build.mjs` → `@electron/packager`로 묶기(`dist/`만 asar에, 웹은 `resources/web`) → zip.
패키지 앱은 `app.isPackaged`라서 위 개발용 환경 변수(`SPACELOG_GPU` 제외)를 읽지 않고, 웹은 `resources/web`에서만 찾는다. 웹은 실행할 때마다 새로 빌드한다(오래된 `web/dist`가 실리지 않게).

**배포는 태그로 한다.** `package.json`의 `version`을 올리고 같은 이름의 태그를 푸시하면 `.github/workflows/release.yml`이 윈도우 x64·맥 arm64·맥 x64 zip을 만들어 **Release 초안**에 붙인다. 초안을 확인하고 Publish를 누르는 건 사람이 한다. 실패한 태그 작업을 다시 돌릴 때는 **먼저 남은 초안을 지운다** — 안 지우면 초안이 하나 더 생긴다.

```bash
git tag v0.1.0
git push origin v0.1.0
```

Actions 탭에서 수동 실행하면 Release 없이 zip만 아티팩트로 받는다.

| 결정 | 이유 |
| --- | --- |
| 윈도우 exe를 Electron 원본 `electron.exe`로 되돌린다 | packager가 exe 리소스(이름·버전)를 고치면 해시가 바뀌어 윈도우 앱 제어(스마트 앱 컨트롤)가 막는다. 2026-11-11 이 PC에서 고친 exe는 "An Application Control policy has blocked this file", 원본은 실행됨. 대가: 파일 속성 설명이 "Electron", exe 아이콘 못 바꿈 |
| 맥은 ad-hoc 재서명 (`codesign --sign -`) | Info.plist를 고쳐 원래 서명이 깨지면 Apple Silicon이 "손상됨"으로 막는다. 공증은 아니라 첫 실행 때 막힌다: macOS 14 이하는 우클릭 → 열기, macOS 15 이상은 시스템 설정 → 개인정보 보호 및 보안 → "그래도 열기" |
| 맥용은 맥 러너에서 만든다 | 윈도우에서 만들면 .app 안의 심볼릭 링크가 깨진다 |
| 설치 마법사·자동 업데이트 없음 | 범위 밖 (#57). zip 풀고 실행 |

| 확인 (2026-11-11) | 결과 |
| --- | --- |
| 윈도우 zip 만들기 (`npm run package`) | 됨. 167MB |
| zip을 새 폴더에 풀어 `SpaceLog.exe` 실행 (윈도우 11, 이 PC) | 실행됨. 서버 health 233ms, 포트 47800이 개발용 앱에 잡혀 있어 47801로 감, `/`에서 패키지 안의 웹(index.html) 200 |
| 드롭·트레이·알림 등 화면 동작 (패키지 앱) | **사람 확인 필요** |
| 다른 PC의 SmartScreen 경고 | **미측정** |
| 맥 zip 만들기·실행 | **미측정** (CI 첫 실행에서 만들어짐, 실행은 맥에서 확인 필요) |

## 구성

| 파일 | 하는 일 |
| --- | --- |
| `main/app.ts` | 진입점. 단일 인스턴스, 드롭존·설정 창, IPC, 측정 |
| `main/serverProcess.ts` | 세션 토큰(32바이트 base64url), 서버 `utilityProcess` 실행, `listening` 메시지로 실제 포트 받기, health 확인, 1번 자동 재시작 |
| `main/api.ts` | 서버 호출 (`X-Session-Token`). 렌더러는 서버를 직접 부르지 않는다 (file:// Origin은 서버 Origin 검사에 걸림) |
| `main/ingest.ts` | 드롭·붙여넣기·단축키 → `POST /api/stars`, 확인 카드 → `PATCH /api/stars` |
| `main/tray.ts` | 트레이 메뉴, 상태 점 3종 (정상 / 서버 오류 빨강 / 보관함 오류 노랑) |
| `main/shortcut.ts` | 전역 단축키 (기본 `CommandOrControl+Shift+Space`) |
| `main/notifier.ts` · `notifySchedule.ts` | 재발견 알림 (하루 1회, 알림 시각 이후, 몰아 보내기 금지) |
| `main/settingsStore.ts` | 설정 저장 |
| `dropzone/DropZone.tsx` | 상태 머신 `collapsed → expanded → dragOver → saving → confirm / error` |
| `dropzone/ConfirmCard.tsx` | 넣은 직후 확인 카드 (행성 일괄 적용, 메모 140자, Enter/Esc, 10초 자동 확정) |
| `dropzone/precheck.ts` | 폴더·200MB·20개·빈 텍스트·디스크 1GB 사전 검사, 종류 판별 |
| `settings/index.tsx` | 설정 창 |
| `dev/mockServer.mjs` | 개발 전용 가짜 서버 |
| `build.mjs` | esbuild로 main·preload·화면과 **apps/server를 함께** `dist/`에 묶는다 |

## SPEC과 다르게 간 것 · 남은 것

- **설정 저장 위치**: SPEC 2-4는 서버와 설정을 공유하지만 서버에 `/api/settings`가 없어(#33 범위 밖) 수집 앱이 `settings.json`에 둔다. 서버에는 보관함 위치를 `SPACELOG_VAULT`로 넘긴다.
- **디스크 남은 공간**: `/api/storage` 대신 수집 앱이 `fs.statfs`로 직접 잰다.
- **100,000자 넘는 텍스트**: 수집 앱이 `.txt` 파일로 만들어 올린다 (SPEC 3-2는 어느 쪽이 만들지 정하지 않음).
- **로그인 시 자동 실행**: 개발 모드에서는 저장만 하고 운영체제에 등록하지 않는다 (등록하면 빈 Electron이 뜬다).
- **보관함 위치 바꾸기**: 서버를 다시 켜서 새 위치를 넘긴다. 이전 보관함의 기록은 옮기지 않는다.
- **트레이 "오늘의 별 보기"**: 알림 클릭이 윈도우 개발 모드에서 오지 않는 문제의 대안 경로 (ADR 0001 4장).
- 아이콘·시안은 디자이너 2 시안(#10) 전 임시 (코드로 그린 트레이 아이콘, 웹 토큰 색).

## 확인한 것 · 못 한 것 (2026-11-11, 윈도우 11 개발 모드)

| 항목 | 결과 |
| --- | --- |
| 사전 검사·종류 판별·알림 시각 판단 (단위 테스트 12개) | 통과 (`npm test`) |
| 자가검증 + 가짜 서버: 보안 5종, 파일(경로·바이트), 폴더 거부, 중복, 21개 중 21번째만 거부, 링크, 텍스트, 빈 텍스트, 확인 카드 PATCH, 단축키 텍스트, 빈 클립보드 | 전부 통과 |
| 실제 서버(`apps/server`, main 기준) 실행·보안 5종 | 통과. 기록 넣기는 서버에 API가 없어 "로컬 서버가 아직 기록 넣기를 지원하지 않아요"로 막힘 (#33 대기) |
| 서버 강제 종료 → 1번 자동 재시작 → 두 번째 종료 시 오류 상태 | 통과 (작업 관리자 대신 `taskkill`로 확인). 트레이 빨간 점·OS 알림은 **화면으로 확인 못 함** |
| 탐색기·브라우저 → 드롭존 드래그, 창 모양·접힘, Enter/Esc, 설정 창 | **사람 확인 필요** |
| 단축키로 클립보드 **이미지** 넣기 | **미검증** (AC-수집-7 ⚠, 자가검증은 텍스트만) |
| 알림 클릭 → 별 상세 | **미검증**. 윈도우 개발 모드에서 클릭 이벤트가 안 오는 것으로 알려짐 |
| 드롭 → 저장 완료 3초, 대기 메모리 | 측정 코드만 넣음 (`collector-metrics.jsonl`의 `dropToConfirmMs`, 60초 뒤 `memory`). **실서버 기준 측정값 없음** |
| 맥 | **미측정** |

### 알려진 문제 (코드 검수에서 나옴, 고치지 않음)

- 윈도우는 `showInactive`로 띄운 창의 포커스를 막을 수 있다. 확인 카드에서 Enter·Esc·메모 입력이 안 되면 카드를 한 번 클릭한다 (`moveTop` 후 `focus`로 완화만 함, **데모 PC에서 확인 필요**).
- 설정 창에서 단축키를 바꾸는 중에 지금 단축키를 누르면 클립보드 넣기가 실행된다.
- 윈도우에서 시간이 지나 알림 센터로 들어간 알림은 클릭해도 반응하지 않을 수 있다.
