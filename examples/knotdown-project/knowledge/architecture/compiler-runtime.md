---
id: "019ffc20-0000-7000-8000-000000000003"
type: "architecture"
status: "stable"
summary: "한 번 파싱한 source-located IR을 Human, Graph, Context, API와 MCP가 함께 사용하는 구조다."
---

[context-model]: ../concepts/background-context.md
[scope-contract]: ../concepts/project-boundary.md
[markdown-contract]: ../reference/markdown-contract.md

# Compiler and Runtime

Knotdown의 프레임워크 경계는 CLI가 아니라 컴파일러 IR과 Knowledge Runtime이다. CLI, 웹 서버, 정적 사이트와 MCP는 같은 코어를 호출하는 어댑터다.

## 파이프라인

```text
Markdown + project.yaml
        |
        v
discover -> parse -> resolve -> validate
        |
        v
source-located IR + typed graph + build ID
        |
        +-- Human and Graph View
        +-- static site and JSON
        +-- Context Pack
        +-- HTTP and MCP
```

입력 발견과 링크 해석은 [scope contract][scope-contract]를 먼저 적용한다. 문법과 document import의 의미는 [Markdown contract][markdown-contract]가 정의한다.

## 하나의 IR

IR은 문서 ID, 타입, 상태, 제목, 요약, 원문, AST, source location, import, reference, embed, mention과 진단을 담는다. 각 어댑터가 독립 파서를 만들지 않으므로 사람용 화면과 Agent용 컨텍스트가 조용히 달라지지 않는다.

## 결정적 빌드

같은 설정과 Markdown은 같은 정렬, graph edge ID와 build ID를 만든다. 현재 시각이나 로컬 절대 경로는 산출물에 들어가지 않는다. 빌드는 임시 디렉터리에서 완성된 뒤 원자적으로 교체되며 실패하면 마지막 성공 결과를 보존한다.

## Context Runtime

[Background Context][context-model]는 search, read, traversal, build, explain 작업을 통해 IR을 제한된 Context Pack으로 투영한다. HTTP와 MCP는 선택 정책을 복제하지 않고 이 런타임에 위임한다.
