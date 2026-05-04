# E2E UI Test Agent

> Chrome 또는 Edge 확장 프로그램으로 AI 기반 E2E 웹 테스트 — 코드 없이 자연어로 테스트를 작성하세요.

AI 에이전트가 자연어 시나리오를 해석하여 브라우저 탭을 직접 제어하고, 별도 설정 없이 모든 웹사이트에서 테스트를 실행합니다.

[한국어](README.ko.md) | [English](README.md)

---

## 주요 기능

- **코딩 불필요** — 테스트할 내용을 자연어로 설명
- **모든 웹사이트 지원** — 사이트별 별도 설정 없음
- **다양한 AI 제공자 지원** — Claude, OpenAI, Azure OpenAI, Ollama
- **실시간 시각적 피드백** — 각 단계가 실행되는 과정을 실시간으로 확인
- **복잡한 UI 처리** — jqGrid 테이블, jsTree 노드, React/Vue 폼 지원
- **한국어 / 영어 UI** — 브라우저 언어 설정에 따라 자동 감지

---

## 동작 방식

```
사이드 패널에서 시나리오 입력
              ↓
현재 페이지 DOM 읽기
(모든 인터랙티브 요소에 고유 ID 자동 부여)
              ↓
DOM 상태 + 시나리오를 AI 제공자에 전송
              ↓
AI가 다음 액션 결정 (click / fill / navigate / wait)
              ↓
시각적 피드백과 함께 액션 실행
              ↓
최대 20번 반복 → PASS / FAIL
```

---

## 데모

**시나리오:** 검색창에 `'Hello, World'`를 입력하고 검색 결과가 표시되는지 확인합니다.

```
Step 1 — Thinking: 페이지에서 검색 입력창을 발견했습니다. 검색어를 입력합니다.
         Action: fill #search-input → "Hello, World"

Step 2 — Thinking: 검색어 입력 완료. 검색 버튼을 클릭합니다.
         Action: click #search-btn

Step 3 — Thinking: 결과 페이지가 로드됐습니다. 결과 항목 렌더링을 기다립니다.
         Action: wait

Step 4 — Thinking: "Hello, World"를 포함한 결과 항목이 표시됩니다. 목표 달성.
         Action: done → ✅ PASS
```

---

## 설치

**요구사항**

- Chrome 114+ 또는 Edge 114+ (Side Panel API 필요)
- 아래 AI 제공자 중 하나 이상의 API 키:
  - [Anthropic Claude](https://console.anthropic.com/)
  - [OpenAI](https://platform.openai.com/)
  - Azure OpenAI
  - [Ollama](https://ollama.com/) (로컬 실행, API 키 불필요)
- 인터넷 연결 (클라우드 AI 제공자 사용 시)

**확장 프로그램 로드**

1. `chrome://extensions` (또는 `edge://extensions`) 접속
2. 우측 상단 **개발자 모드** 토글 ON
3. **압축해제된 확장 프로그램을 로드합니다** 클릭 후 이 폴더 선택
4. 툴바에 확장 프로그램 아이콘이 나타나면 설치 완료

---

## 사용 방법

1. 테스트할 웹사이트로 이동
2. 확장 프로그램 아이콘 클릭 → 사이드 패널 열림
3. **설정** 탭에서 AI 제공자를 선택하고 API 키 입력 (로컬 저장, 최초 1회)
4. **시나리오** 탭으로 전환
5. 시나리오를 직접 입력하거나 `.json` 파일 로드
6. **에이전트 실행** 클릭 후 각 단계가 실행되는 과정을 실시간으로 확인
7. PASS / FAIL 결과 및 전체 실행 로그 확인

### 시나리오 작성

테스트할 내용과 검증할 사항을 자연어로 작성합니다:

```
검색창에 'Hello, World'를 입력하고 검색 결과가 표시되는지 확인해줘.
```
```
장바구니에 상품을 추가하고 결제 페이지로 이동하는지 확인해줘.
```
```
회원가입 폼의 모든 필드를 입력하고 제출 후 성공 메시지가 나오는지 확인해줘.
```

여러 시나리오를 순서대로 실행하려면 `.json` 파일을 로드하세요:

```json
[
  {
    "id": "TC-001",
    "title": "검색 테스트",
    "description": "검색 결과가 표시되는지 확인",
    "scenario": "검색창에 'Hello, World'를 입력하고 결과가 표시되는지 확인해줘."
  },
  {
    "id": "TC-002",
    "title": "장바구니 테스트",
    "description": "상품을 장바구니에 추가할 수 있는지 확인",
    "scenario": "첫 번째 상품을 클릭하고 장바구니에 추가한 뒤 장바구니 수량이 증가하는지 확인해줘."
  }
]
```

전체 형식은 [`scenarios.example.json`](scenarios.example.json)을 참고하세요.

---

## 지원 액션

| 액션 | 설명 |
|------|------|
| `click` | 버튼, 링크, 탭 클릭 |
| `fill` | 입력창에 텍스트 입력 (React/Vue 호환) |
| `navigate` | 특정 URL로 이동 |
| `wait` | 비동기 처리 대기 |
| `done` | 최종 PASS / FAIL 판정 |

---

## AI 제공자 설정

| 제공자 | 필수 입력 항목 | 비고 |
|--------|--------------|------|
| **Claude** | API 키 | 기본 모델: `claude-sonnet-4-6` |
| **OpenAI** | API 키 | 기본 모델: `gpt-4o` |
| **Azure OpenAI** | API 키, 엔드포인트, 배포명, API 버전 | 기업 환경용 |
| **Ollama** | 엔드포인트, 모델명 | 로컬 실행, API 키 불필요 |

API 키는 Chrome 로컬 스토리지에 저장되며, 설정된 제공자 엔드포인트 외부로는 전송되지 않습니다.

---

## 라이선스

MIT
