---
name: init
description: 새 프로젝트 또는 일일 과제 레포지토리를 초기화합니다. README.md(Git 룰), docs/ 폴더, .gitignore, 그리고 rebase를 강제하는 Git 훅(.githooks/pre-push)을 자동 생성합니다.
---

# `/init` — 프로젝트 레포지토리 초기화 스킬

새로운 과제나 프로젝트를 시작할 때 현재 디렉토리를 표준 협업 구조로 스캐폴딩하고, **최신 `main` 리베이스 없이 푸시하는 것을 원천 차단하는 Git 훅**을 자동 설정합니다.

## 실행 절차

### 1. 프로젝트명 확인
- 사용자가 인자로 전달한 프로젝트명을 확인합니다. (예: `/init 편의점 할인 레이더`)
- 인자가 없다면 현재 작업 디렉토리의 폴더명을 기본 프로젝트명으로 사용하거나 한 줄로 묻습니다.

### 2. 파일 및 디렉토리 생성
현재 작업 디렉토리에 다음 파일들을 생성합니다:

#### 1) `docs/` 디렉토리
- 문서들이 저장될 기본 디렉토리를 마련합니다 (`docs/.gitkeep`).

#### 2) `.gitignore` (스마트 병합)
- 이미 `.gitignore`가 존재하면 **기존 내용을 절대 덮어쓰지 않고**, 다음 필수 보안/캐시 패턴 중 누락된 항목만 파일 끝에 덧붙입니다(Append):
  ```gitignore
  # [E-Jo Rules] 필수 보안 및 환경설정
  .env
  .env.local
  *.key
  __pycache__/
  *.py[cod]
  venv/
  .venv/
  node_modules/
  dist/
  .DS_Store
  Thumbs.db
  ```
- `.gitignore`가 없으면 위 표준 템플릿으로 신규 생성합니다.

#### 3) `.githooks/pre-push` (리베이스 강제화 훅)
- 푸시할 때 로컬 브랜치가 최신 `origin/main`을 바탕으로 작성되었는지 검사하고, 아니면 **푸시를 차단**하는 훅 스크립트를 생성합니다:
  ```sh
  #!/bin/sh
  # Git pre-push hook: 최신 origin/main 리베이스 여부 검사
  current_branch=$(git symbolic-ref --short HEAD 2>/dev/null)
  if [ "$current_branch" = "main" ] || [ "$current_branch" = "master" ]; then
    exit 0
  fi

  # origin/main 최신 커밋 확인
  git fetch origin main --quiet 2>/dev/null
  if [ $? -ne 0 ]; then
    exit 0
  fi

  # 현재 브랜치가 origin/main의 최신 커밋을 조상으로 가지고 있는지 확인
  if ! git merge-base --is-ancestor origin/main HEAD 2>/dev/null; then
    echo ""
    echo "❌ [Git Push 차단] 현재 브랜치가 최신 origin/main을 반영하고 있지 않습니다!"
    echo "👉 충돌 방지를 위해 먼저 아래 명령어로 리베이스한 뒤 다시 푸시하세요:"
    echo "   git fetch origin && git rebase origin/main"
    echo ""
    exit 1
  fi
  exit 0
  ```

#### 4) Git 훅 활성화 (명령어 실행)
- AI 에이전트는 가능할 경우 다음 명령어를 실행하여 현재 레포에 훅을 즉시 활성화합니다:
  ```bash
  git config core.hooksPath .githooks
  ```

#### 5) `README.md` (스마트 병합)
- **`README.md`가 이미 존재하는 경우**:
  - 기존 과제 설명이나 프로젝트 소개 내용을 **100% 그대로 보존**합니다.
  - 이미 `## 📌 팀 협업 파이프라인` 섹션이 포함되어 있다면 중복 작성을 건너뜁니다.
  - 포함되어 있지 않다면, 기존 내용의 맨 아래에 다음 협업 규칙 섹션을 덧붙입니다(Append):
    ```markdown

    ---

    ## 📌 팀 협업 파이프라인
    1. `/init` ➔ 2. `/prd` ➔ 3. `/toPolicy` ➔ 4. `/toSpec` ➔ 5. `/toIssue` ➔ 6. `/impl` ➔ 7. `/pr`

    ## 🛡️ Git 3대 수칙 (충돌 방지 자동화)
    1. **브랜치 시작 전**: 항상 최신 main 당겨오기
       ```bash
       git checkout main && git pull origin main
       git checkout -b feat/#이슈번호-작업명
       ```
    2. **PR 올리기 전**: 최신 main으로 rebase하기 (미리베이스 시 Git Push 자동 차단)
       ```bash
       git fetch origin && git rebase origin/main
       ```
    3. **머지 조건**: 작성자 외 팀원 1명 이상의 Approve(승인) 필수.

    ## 📁 문서 위치
    - 기획서: `docs/PRD.md`
    - 정책서: `docs/POLICY.md`
    - 스펙서: `docs/SPEC.md`
    - 이슈 관리: GitHub Issues 탭
    ```
- **`README.md`가 없는 경우**:
  - 프로젝트명을 타이틀로 하여 위 협업 규칙과 문서 안내가 포함된 신규 `README.md`를 생성합니다.
