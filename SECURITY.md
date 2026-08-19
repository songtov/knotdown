# Security policy

Knotdown treats project boundaries, symlink handling, generated output, and agent-facing content as security-sensitive behavior.

## Supported versions

The project is currently alpha software. Security fixes are applied to the newest published alpha only.

## Reporting a vulnerability

Do not open a public issue. After the GitHub repository is created, use its **Security → Report a vulnerability** form to submit a private advisory. Include the affected command, a minimal project tree, expected boundary, observed behavior, and whether a symlink or generated artifact is involved.

The maintainer will acknowledge a complete report within seven days and coordinate disclosure after a fix is available. Never include real vault contents, credentials, or personal paths in a report.

## Security model

- Project roots are explicit and outside-root or symlink escapes fail closed.
- `check`, `build`, `dev`, and MCP access do not modify source Markdown.
- MCP tools are read-only and require the loaded project ID.
- Note content is wrapped as untrusted evidence before it is returned to an agent.
- No network service is required for compilation; the development server binds to loopback by default.
