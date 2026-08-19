---
id: "019ffc10-7b6a-7b34-8b3c-15e7251ab001"
type: "guide"
status: "stable"
summary: "Knotdown이 Markdown을 사람용 지식과 Agent용 배경 컨텍스트로 컴파일하는 방식을 안내한다."
---

[context-model]: ./concepts/background-context.md
[프로젝트 경계]: ./concepts/project-boundary.md
[compiler-runtime]: ./architecture/compiler-runtime.md
[markdown-contract]: ./reference/markdown-contract.md
[obsidian-adoption]: ./guides/obsidian-adoption.md
[mcp-integration]: ./integrations/mcp.md
[diagnostics-runbook]: ./runbooks/context-diagnostics.md

# Knotdown

Knotdown은 한 프로젝트의 Markdown을 사람이 탐색할 수 있는 문서 사이트와 AI Agent가 작업 전에 읽을 수 있는 설명 가능한 배경 컨텍스트로 컴파일하는 로컬 우선 프레임워크다.

답을 생성하거나 원문을 자동으로 고치는 제품이 아니다. Markdown과 `.knowledge/project.yaml`을 정본으로 유지하면서 Human View, Graph View, Context Pack, HTTP API, MCP가 같은 컴파일 결과를 사용하게 한다.

## 왜 필요한가

Markdown 폴더만으로는 어떤 파일이 한 프로젝트인지, 같은 이름의 문서가 무엇을 의미하는지, Agent에게 어떤 문서를 전달했는지 설명하기 어렵다. Knotdown은 먼저 [프로젝트 경계]를 고정하고 안정 ID, 타입 관계, 결정적 build ID, 포함·제외 이유를 추가한다.

프로젝트 경계는 검색, 그래프 탐색, 컨텍스트 구성, HTTP와 MCP 호출 전체에 동일하게 적용된다.

## 핵심 모델

[Background Context 모델][context-model]은 프로젝트 배경, 현재 작업, 작업 관련 지식, 그래프 의존성, 선택 근거를 하나의 Context Pack으로 묶는다. Agent View는 답변 화면이 아니라 외부 Agent가 받을 내용을 확인하는 Context Debugger다.

[Compiler and Runtime][compiler-runtime]은 Markdown을 한 번 파싱해 공통 IR과 타입 그래프를 만든다. 브라우저와 Agent 어댑터가 독자적으로 문서를 해석하지 않기 때문에 같은 build ID와 출처를 유지할 수 있다.

## 기존 문서와 에디터

[Markdown Contract][markdown-contract]는 표준 Markdown reference definition을 문서 단위 import로 해석한다. 별도의 가시적 DSL을 요구하지 않는다.

Obsidian 사용자는 [Obsidian Adoption][obsidian-adoption] 흐름으로 볼트 전체가 아닌 프로젝트 하위 폴더만 채택할 수 있다. 원문 frontmatter를 강제로 추가하지 않고 안정 ID는 sidecar에 보관한다.

## Agent 연결

[MCP Integration][mcp-integration]은 검색, 문서 읽기, 그래프 탐색, 컨텍스트 구성과 설명을 읽기 전용 도구로 제공한다. 각 호출은 프로젝트 ID를 요구하며 Markdown은 실행할 명령이 아니라 신뢰되지 않은 근거로 전달된다.

문제가 생기면 [Context Diagnostics][diagnostics-runbook]에서 누락 링크, 모호한 문서명, 범위 이탈, 예상과 다른 Context Pack을 순서대로 점검한다.

## 3분 둘러보기

1. 왼쪽 문서 트리에서 Background Context와 Compiler and Runtime을 연다.
2. 본문 링크에 마우스를 올려 요약과 역참조를 확인한다.
3. Graph View에서 `imports`, `references`, `mentions`를 각각 필터링한다.
4. Agent View에서 Markdown Contract를 entrypoint로 선택하고 `기존 Markdown을 Agent 배경으로 제공하는 방법`을 입력한다.
5. Context Pack에 들어온 문서, 선택 이유, 그래프 경로와 토큰 비용을 확인한다.
