# ADR 0001 스파이크 — Electron 후보 (A)

수집 앱 기술 스택 결정([docs/adr/0001](../../docs/adr/0001-collector-server-stack.md))을 위한 버리는 코드다. 실제 수집 앱이 아니다.

- `main.js`: 드롭존 창, 트레이, 전역 단축키(`Ctrl/⌘+Shift+Space`), 알림, 서버 실행·1회 재시작
- `server.js`: `utilityProcess`로 뜨는 최소 서버. Host·Origin·토큰 검사, `GET /api/health`, 받은 바이트만 세는 `POST /api/stars`
- `measure.js`: 앱을 띄워 실행 시간과 1분 뒤 메모리를 재고 종료

## 실행

```bash
npm install
npm start                       # 직접 써 보기
node measure.js --dev           # 실행 시간 + 1분 뒤 메모리
SPIKE_NO_GPU=1 node measure.js --dev    # GPU 가속 끄고 측정
SPIKE_SELFTEST=1 node measure.js --dev  # 자가검증 (클립보드 내용을 덮어쓴다)
```

결과는 `%APPDATA%/spacelog-spike-electron/spike-metrics.json` (맥: `~/Library/Application Support/spacelog-spike-electron/`)에 쌓인다. 트레이 메뉴 "측정 파일 열기"로도 열 수 있다.

## 사람이 확인할 것 (ADR 4장 1·2·4번)

`npm start` 후 화면 오른쪽 드롭존 창의 로그를 본다.

1. 탐색기(Finder)에서 파일 여러 개를 끌어다 놓기 → `files=N`, `저장 완료`
2. 브라우저 주소창의 링크, 웹페이지의 이미지, 선택한 텍스트를 각각 끌어다 놓기 → `types=[...]`에 `text/uri-list`·`text/plain`이 보이고 `link`·`text`로 저장
3. 트레이 메뉴 "알림 테스트" → 알림 클릭 → 브라우저가 열리고 로그에 `알림 클릭됨`
4. 다른 앱에서 텍스트·이미지를 복사하고 `Ctrl+Shift+Space` → `shortcut-text`·`shortcut-image`

## 알려진 문제

- `npm run package`로 만든 서명 없는 실행 파일은 윈도우 앱 제어 정책에 막혀 실행되지 않을 수 있다. 측정은 개발 모드로 했다.
- 윈도우 개발 모드에서 알림은 뜨지만 클릭 이벤트가 오지 않았다. `SPIKE_NO_AUMID=1`(앱 ID 지정 끄기)도 소용없었다. 설치본(시작 메뉴 바로가기 있음)에서 다시 확인해야 한다.
