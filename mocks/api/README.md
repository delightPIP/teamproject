# API 목업 (1일 차, 개발 B)

실제 서버(#4)가 나오기 전까지 이 JSON으로 작업한다. 형식 기준은 `packages/shared/types.ts`, 오류는 `packages/shared/errors.ts`. 가상의 "오늘"은 **2026-11-11 (KST)** 이다.

| 파일 | API | 상황 |
| --- | --- | --- |
| `health.json` | `GET /api/health` | 정상 |
| `universe.json` | `GET /api/universe?from=2026-11-11&to=2026-11-11` | 오늘 별 6개, 행성 7개 (기간 안 별 0개인 행성 포함 → 목록에서 흐리게) |
| `universe.empty.json` | 〃 | 첫 실행 직후: 기록 0건, 기본 행성 6개 |
| `stars/image.json` | `GET /api/stars/:id` | 이미지 정상 + 메모 |
| `stars/thumbnail-pending.json` | 〃 | 썸네일 만드는 중 → 스켈레톤 |
| `stars/file.json` | 〃 | PDF 파일 (썸네일 없음 → 유형 아이콘) |
| `stars/link.json` | 〃 | 링크 정보 가져옴 |
| `stars/link-failed.json` | 〃 | 링크 정보 실패 → 제목 자리에 도메인 |
| `stars/text.json` | 〃 | 텍스트 + 메모 |
| `stars/original-missing.json` | 〃 | 원본 없음 ⚠ |
| `stars.post.json` | `POST /api/stars` | 4개 넣음: 1개 생성, 1개 중복, 2개 거부 |
| `rediscovery/today.json` · `today.null.json` | `GET /api/rediscovery/today` | 7일 전 별 / 후보 없음 |
| `export.json` · `export.overLimit.json` | `POST /api/export` | 일반 / 50,000자 초과 경고 |
| `settings.json` | `GET /api/settings` | 기본 설정 |
| `storage.json` · `storage.lowDisk.json` | `GET /api/storage` | 여유 / 1GB 미만 |
| `errors.json` | 모든 API | 오류 코드 18종 응답 예시 (`{"error":{"code","message"}}`) |

`npm test`가 목업과 타입이 어긋나는지 검사한다 (`mocks.test.ts`). 타입을 바꾸면 목업도 같이 고친다.
