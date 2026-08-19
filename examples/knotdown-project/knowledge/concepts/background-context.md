---
id: "019ffc20-0000-7000-8000-000000000001"
type: "concept"
status: "stable"
summary: "프로젝트 Markdown에서 Agent가 작업 전에 알아야 할 배경지식을 선택하고 설명하는 모델이다."
---

[scope-contract]: ./project-boundary.md

# Background Context

Background Context는 Agent에게 정답을 미리 써주는 프롬프트가 아니다. 현재 작업을 올바르게 해석하기 위해 필요한 프로젝트 고유의 사실, 용어, 제약, 관련 문서와 출처를 제공하는 증거 묶음이다.

## 다섯 층

| 층 | 역할 |
| --- | --- |
| Project baseline | 프로젝트 목적, 용어, 아키텍처와 공통 정책 |
| Working context | 현재 편집하거나 조사하는 문서 |
| Task context | 사용자의 작업과 직접 관련된 지식 |
| Dependencies | imports, references, embeds로 연결된 선행 지식 |
| Trace | 경로, 포함 이유, 토큰 비용과 제외 이유 |

모든 층은 [scope contract][scope-contract] 안에서만 선택된다. 다른 프로젝트나 볼트의 이웃 폴더는 검색 결과와 Context Pack에 섞이지 않는다.

## Context Pack

Context Pack은 각 항목에 문서 ID, 프로젝트 상대 경로, 표현 수준, 선택 이유와 그래프 경로를 붙인다. 전체 원문이 예산을 넘으면 summary나 metadata로 낮추고, 들어가지 못한 후보도 이유와 함께 기록한다.

## 현재 알파와 다음 단계

현재 알파는 entrypoint 또는 lexical query를 시작점으로 삼아 outgoing 그래프를 확장한다. 항상 포함되는 baseline, entrypoint와 query의 결합, heading 단위 선택은 다음 context-runtime 단계다.

이 구분은 중요하다. 현재 제공하는 것을 과장하지 않으면서도 Markdown이 Agent의 배경지식 계층이 되는 최종 모델을 명확히 유지한다.
