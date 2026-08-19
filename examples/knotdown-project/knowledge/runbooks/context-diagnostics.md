---
id: "019ffc20-0000-7000-8000-000000000007"
type: "runbook"
status: "stable"
summary: "문서가 누락되거나 Context Pack이 예상과 다를 때 범위부터 선택 이유까지 점검하는 절차다."
---

[scope-contract]: ../concepts/project-boundary.md
[compiler-runtime]: ../architecture/compiler-runtime.md

# Context Diagnostics

Context Pack이 예상과 다르면 검색 알고리즘부터 바꾸지 말고 입력과 [scope contract][scope-contract]를 먼저 확인한다.

## 1. 프로젝트 검사

```bash
knotdown check .
```

누락 ID, 중복 ID, 잘못된 YAML, 존재하지 않는 import, 모호한 wikilink와 경계 이탈을 해결한다. blocking error가 있으면 정상 산출물을 만들지 않는다.

## 2. 그래프 검사

```bash
knotdown graph .
```

원하는 문서 사이에 `imports`, `references`, `embeds`가 실제로 존재하는지 확인한다. 일반 inline link는 타입 edge가 아니며 weak mention은 기본 확장 관계가 아니다.

## 3. Context Pack 설명

Agent View 또는 `explain_context`에서 다음을 확인한다.

- entrypoint와 query가 의도한 값인가
- traversal depth와 허용 relation이 충분한가
- token budget이나 document limit으로 제외됐는가
- full 대신 summary 또는 metadata가 선택됐는가
- 포함 이유와 graph path가 예상한 의존성을 가리키는가

## 4. 같은 build 확인

Human, Graph, Agent, HTTP와 MCP가 같은 build ID인지 확인한다. 다르면 [compiler and runtime][compiler-runtime]의 watcher 또는 정적 빌드를 다시 실행한다.

## 5. 현재 알파의 경계

entrypoint가 지정된 요청은 현재 query 검색 결과를 합치지 않는다. 항상 포함되는 baseline과 heading 단위 검색도 아직 없다. 이 동작을 문서 누락 버그와 혼동하지 않는다.
