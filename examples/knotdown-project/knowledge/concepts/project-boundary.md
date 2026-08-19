---
id: "019ffc20-0000-7000-8000-000000000002"
type: "concept"
status: "stable"
summary: "검색과 그래프, Context Pack이 하나의 명시적인 프로젝트 루트를 벗어나지 못하게 하는 안전 계약이다."
---

# Project Boundary

프로젝트는 `.knowledge/project.yaml`이 있는 디렉터리다. 설정의 content roots, include, exclude가 발견 가능한 Markdown의 집합을 결정한다.

## 불변 조건

- 모든 문서와 그래프 edge는 같은 project ID에 속한다.
- 상대 경로가 루트 밖으로 나가면 컴파일을 중단한다.
- symbolic link의 실제 경로가 루트나 content root를 벗어나도 중단한다.
- 검색, traversal, context, HTTP와 MCP 요청은 project ID 불일치를 거부한다.
- 빌드 결과에는 로컬 절대 경로를 기록하지 않는다.

## 안정 ID

문서 경로와 제목은 바뀔 수 있지만 문서 ID는 유지되어야 한다. Standard 모드는 frontmatter UUID를 사용하고, Obsidian 모드는 명시적인 adopt 과정으로 sidecar UUID를 만들 수 있다.

## 실패를 닫힌 상태로 처리하기

누락되거나 모호한 링크를 임의로 추측하지 않는다. 잘못된 범위, 중복 ID, 존재하지 않는 대상은 진단으로 드러나며 blocking error가 있으면 마지막 성공 빌드를 교체하지 않는다.
