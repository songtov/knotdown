---
id: "019ffc20-0000-7000-8000-000000000005"
type: "guide"
status: "stable"
summary: "기존 Obsidian 볼트의 한 프로젝트 폴더를 원문 변경 없이 Knotdown에 연결하는 절차다."
---

[scope-contract]: ../concepts/project-boundary.md
[markdown-contract]: ../reference/markdown-contract.md

# Obsidian Adoption

볼트 전체가 아니라 하나의 프로젝트를 나타내는 하위 폴더를 Knotdown root로 선택한다. 이 선택이 [scope contract][scope-contract]의 출발점이다.

## 초기화

```bash
cd "/path/to/vault/Projects/product-alpha"
npx knotdown@next init . --preset obsidian
npx knotdown@next adopt .
npx knotdown@next check .
npx knotdown@next dev .
```

`init`은 `.knowledge/project.yaml`과 빈 sidecar를 만든다. `adopt`는 발견한 노트의 안정 ID를 `.knowledge/identities.json`에 기록하지만 노트에는 frontmatter를 삽입하지 않는다.

## 지원하는 연결

- `[[Document]]`
- `[[Document|display label]]`
- `[[Document#Heading]]`
- `[[Document#^block-id]]`
- `![[Document]]`와 fragment embed

같은 이름이 여러 폴더에 있으면 명시적인 경로를 사용한다. 존재하지 않는 대상, 모호한 이름, 프로젝트 밖 경로는 진단으로 중단한다.

## Standard와의 차이

[Markdown contract][markdown-contract]의 Standard 모드는 문서 안의 UUID와 type을 요구한다. Obsidian 모드는 기존 작성 습관을 보존하기 위해 선택적 frontmatter와 sidecar identity를 제공한다. 두 모드는 같은 IR과 브라우저, Context Runtime을 사용한다.
