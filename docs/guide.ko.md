# Knotdown 한국어 가이드

Knotdown은 한 Markdown 프로젝트 폴더를 사람이 탐색할 수 있는 지식 사이트와 AI가 안전하게 읽을 수 있는 범위 제한 컨텍스트로 컴파일하는 프레임워크입니다. Obsidian을 편집기로 그대로 사용하면서 프로젝트 하위 폴더만 브라우저와 AI에 노출할 수 있습니다.

## 기존 일반 Markdown 폴더에 적용

```bash
cd "/내 프로젝트/docs"
npx knotdown@next init . --preset standard
npx knotdown@next check .
npx knotdown@next dev .
```

각 문서에 UUID `id`, `type`, H1 제목이 이미 있으면 바로 사용할 수 있습니다. 다른 문서를 그래프 의존성으로 선언할 때는 `[인증]: ./authentication.md` 같은 표준 Markdown reference definition을 쓰고 본문에서 `[인증]`을 사용합니다. 일반 인라인 링크도 Human View에서 이동할 수 있지만 v0.1의 타입 그래프 관계를 선언하지는 않습니다.

계약이 빠진 기존 문서는 `check`가 수정 없이 진단합니다. 자세한 선택 기준과 예시는 [기존 Markdown 적용 가이드](adopting-existing-markdown.md)를 참고하세요.

## 기존 Obsidian 폴더에 적용

```bash
cd "/내 볼트/Projects/product-alpha"
npx knotdown@next init . --preset obsidian
npx knotdown@next adopt .
npx knotdown@next check .
npx knotdown@next dev .
```

- `init`: `.knowledge/project.yaml`과 빈 ID 사이드카를 만듭니다. 노트는 수정하지 않습니다.
- `adopt`: 명시적으로 실행했을 때만 `.knowledge/identities.json`에 안정 ID를 추가합니다.
- `check`: 프로젝트 범위, 링크, ID, 설정을 검사하며 쓰지 않습니다.
- `dev`: Human·Graph·Agent View를 로컬에서 엽니다.
- `build`: `.knowledge/dist`에 정적 사이트, Markdown/JSON, 그래프, `llms.txt`를 만듭니다.
- `mcp`: 같은 IR을 사용하는 읽기 전용 AI 도구 5개를 stdio로 제공합니다.

`[[문서]]`, `[[문서|표시명]]`, 헤딩/블록 링크와 `![[임베드]]`를 지원합니다. 동일 이름이 둘이면 자동 선택하지 않고 `KB208`로 중단합니다. 프로젝트 루트 밖 링크와 심볼릭 링크 우회도 차단합니다.

## 공개 전 확인

```bash
npm ci
npm run verify
npm run release:check
```

마지막 명령은 실제 npm tarball을 만들고 빈 프로젝트에 설치한 뒤 `help`, `check`, `build`, `context`, `dev`, `mcp`를 검증합니다. GitHub 저장소·npm Trusted Publisher·도메인·실제 배포처럼 계정이 필요한 단계는 `docs/maintainers/manual-setup.md`에만 남겨 두었습니다.
