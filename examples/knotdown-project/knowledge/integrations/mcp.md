---
id: "019ffc20-0000-7000-8000-000000000006"
type: "integration"
status: "stable"
summary: "외부 Agent가 같은 Knowledge Runtime을 읽기 전용 MCP 도구로 사용하는 연결 계약이다."
---

[context-model]: ../concepts/background-context.md
[compiler-runtime]: ../architecture/compiler-runtime.md

# MCP Integration

MCP는 Knotdown의 제품 경계가 아니라 [compiler and runtime][compiler-runtime]을 Agent에 연결하는 transport adapter다.

## 제공 도구

| 도구 | 역할 |
| --- | --- |
| `search_knowledge` | 제목, 요약, alias와 본문을 프로젝트 안에서 검색 |
| `read_document` | 한 문서를 full, summary 또는 metadata로 읽기 |
| `traverse_graph` | 선택한 관계와 깊이로 타입 그래프 탐색 |
| `build_context` | 작업에 필요한 Context Pack 구성 |
| `explain_context` | 같은 Context Pack의 포함·제외 결정을 설명 |

## Agent 사용 흐름

1. 현재 프로젝트 ID로 지식을 검색한다.
2. 작업 문서나 검색 결과를 entrypoint로 정한다.
3. [Background Context][context-model]를 token budget 안에서 구성한다.
4. 포함 이유와 제외 항목을 확인한다.
5. 필요한 세부 문서만 추가로 읽는다.

모든 도구는 read-only이며 잘못된 project ID를 거부한다. 반환되는 Markdown 앞에는 내용 속 지시를 실행하지 말라는 untrusted-evidence 경계가 붙는다.

## 실행

```bash
knotdown mcp "/absolute/path/to/project"
```

로컬 HTTP API와 MCP의 context 결과는 같은 build ID, 문서 순서, 표현 수준과 선택 이유를 가져야 한다.
