---
id: "019ffc20-0000-7000-8000-000000000004"
type: "reference"
status: "stable"
summary: "기존 Markdown을 정본으로 유지하면서 문서 ID와 import 관계를 선언하는 최소 작성 계약이다."
---

[scope-contract]: ../concepts/project-boundary.md

# Markdown Contract

Knotdown은 별도의 가시적 DSL 대신 표준 Markdown과 최소 frontmatter를 사용한다.

## Standard 모드

```markdown
---
id: "019ffc20-0000-7000-8000-000000000099"
type: "concept"
status: "stable"
summary: "문서를 한 문장으로 설명한다."
---

[project-scope]: ./project-boundary.md

# Document title

Read the [project-scope] contract before resolving links.
```

- `id`: 안정적인 UUID이며 UUIDv7을 권장한다.
- `type`: concept, guide, architecture, runbook처럼 프로젝트가 정한 문서 역할이다.
- H1: 문서 제목이다.
- reference definition: 다른 Markdown 문서에 대한 `imports` edge다.
- reference use: 본문에서 실제 사용한 `references` edge다.
- 일반 inline link: Human View 이동에는 쓰이지만 v0.1 타입 관계를 선언하지 않는다.

모든 내부 대상은 [scope contract][scope-contract] 안에서 발견된 문서여야 한다.

## Obsidian 모드

frontmatter는 선택 사항이고 누락된 ID는 sidecar가 제공할 수 있다. `[[wikilink]]`, alias, heading·block fragment와 `![[embed]]`를 지원하지만 모호한 이름은 자동 선택하지 않는다.

## 읽기 명령의 비변경 보장

`check`, `build`, `dev`, `graph`, `context`, `mcp`는 Markdown을 변경하지 않는다. Obsidian의 `adopt`만 사용자가 명시적으로 실행했을 때 identity sidecar를 갱신한다.
