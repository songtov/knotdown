# Browser theme extension contract

Themes belong to `knotdown/web`; the compiler and common IR do not depend on them. A theme may change presentation but cannot change discovery, identity, graph edges, context selection, or build IDs.

```ts
import { renderDocumentPage } from "knotdown/web";

const html = renderDocumentPage(project, document, diagnostics, {
  theme: {
    colors: {
      accent: "#7652b3",
      accentSoft: "#eee8f8",
      paper: "#fcfbff"
    }
  }
});
```

Supported keys are `ink`, `muted`, `line`, `paper`, `panel`, `accent`, `accentSoft`, and `warning`. Values are restricted to 3-, 6-, or 8-digit hex colors so generated CSS cannot inject arbitrary rules. New renderer adapters should accept the common IR and emit disposable output; they must not add a second parser or retrieval policy.
