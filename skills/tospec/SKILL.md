---
name: tospec
description: docs/PRD.md와 docs/POLICY.md를 통합하여 화면 구조, UI 컴포넌트, 데이터 모델, 상태 변화를 구체화한 docs/SPEC.md를 생성합니다.
---

# `/tospec` — 상세 구현 명세(SPEC) 생성 스킬

`docs/PRD.md`의 요구사항과 `docs/POLICY.md`의 규칙을 결합하여, 개발자와 디자이너가 바로 코드를 짤 수 있는 **화면 구조 및 기능 상세 명세서(`docs/SPEC.md`)**를 작성합니다.

## 실행 절차

### 1. `PRD.md`와 `POLICY.md` 통합 분석
- `docs/PRD.md`와 `docs/POLICY.md`가 존재하는지 확인하고 로드합니다.
- 요구사항을 구현하기 위해 필요한 **화면 요소, 데이터 형태, 상태 흐름**을 도출합니다.

### 2. `docs/SPEC.md` 작성 및 저장
다음 표준 구조에 맞춰 `docs/SPEC.md`를 생성합니다:

```markdown
# 📐 상세 구현 명세 (SPEC)

## 1. 화면 및 UI 컴포넌트 구조
- **상단 영역 (Header / Nav)**: 서비스 타이틀, 기준시각 표시, 필터/스위치 버튼
- **메인 영역 (Content)**:
  - 목록/그리드 카드 레이아웃
  - 상태 배지(할인율, 브랜드 등)
- **하단 영역 (Footer / Status)**: 데이터 출처, API 상태 표시기

## 2. 데이터 모델 (Data Schema)
```javascript
// 또는 Python dict 구조
{
  "id": "고유 식별자 (string | number)",
  "title": "상품/항목 이름 (string)",
  "originalPrice": "정가 (number)",
  "salePrice": "할인가 (number)",
  "discountRate": "할인율 % (number - POLICY 공식 준수)",
  "badge": "배지 텍스트 (string - 1+1, HOT 등)",
  "status": "정상 | 오류 | 가격문의"
}
```

## 3. 핵심 로직 및 인터랙션 흐름
1. **초기 로드 (Init)**: 데이터 소스에서 데이터를 가져와 화면에 렌더링.
2. **필터/정렬 (Filter & Sort)**: 사용자가 조건을 변경하면 실시간으로 목록을 갱신.
3. **예외 상태 (Error & Empty)**: 데이터 로드 실패 시 `POLICY`의 Fallback 배너 렌더링.

## 4. 모듈 및 파일 구성 제안
- `src/` 또는 프로젝트 구조에 맞춘 추천 파일 목록:
  - 데이터 로더 / API 호출 모듈
  - UI 렌더러 / 컴포넌트 모듈
  - 메인 진입점 및 스타일
```

### 3. 완료 안내
`docs/SPEC.md` 생성 완료를 보고하고 다음 단계를 안내합니다:
> "✅ `docs/SPEC.md`가 생성되었습니다. 이제 팀원들이 작업할 독립 이슈 티켓을 쪼개기 위해 **/toissue**를 실행하세요."
