# Maintainer-only external setup

Everything in this file requires an account, a final public URL, or an explicit publish action. Do these steps only after local `npm run release:check` passes.

## Name and repository

- [ ] Confirm `knotdown` is available or owned on npm with `npm view knotdown`.
- [ ] Check GitHub repository/organization availability, a practical domain, Homebrew formula naming, and obvious trademark conflicts.
- [ ] Initialize Git locally, choose `main`, create the public GitHub repository, add the remote, and push.
- [ ] Add the final `repository`, `homepage`, and `bugs` URLs to `package.json`. npm provenance requires the repository URL to match the publishing workflow identity.
- [ ] Replace or add exact GitHub contact links in `.github/ISSUE_TEMPLATE/config.yml` only after the URL exists.

## GitHub settings

- [ ] Add topics: `markdown`, `knowledge-graph`, `obsidian`, `mcp`, `ai`, `typescript`.
- [ ] Enable Discussions and private vulnerability reporting.
- [ ] Create labels used by the forms: `type: bug`, `type: feature`, `status: triage`, plus `good first issue`, `help wanted`, `area: obsidian`, `area: mcp`, `area: browser`.
- [ ] Protect `main`: require pull requests and the CI `verify` and `package-smoke` checks; block force pushes and branch deletion.
- [ ] Keep the default workflow token read-only. The release job alone already requests `id-token: write` for npm OIDC.

## npm trusted publishing

- [ ] Create or claim the npm package and enable 2FA for the maintainer account.
- [ ] Configure npm Trusted Publisher for the exact GitHub owner/repository and `.github/workflows/release.yml`.
- [ ] Do not create a long-lived `NPM_TOKEN`; the workflow uses OIDC and provenance.
- [ ] Confirm `npm run release:check`, then create tag `v0.1.0-alpha.1` and a matching prerelease in GitHub. The workflow rejects a tag/version mismatch and publishes prereleases under `next`.

## Demo and launch

- [ ] Deploy `examples/obsidian-vault/product-alpha/.knowledge/dist/site` with one provider from `docs/deployment.md` and add its URL to README.
- [ ] Capture the 20–30 second terminal/browser GIF using `docs/launch/demo-script.md`; record the optional three-minute walkthrough.
- [ ] Post the prepared launch text from `docs/launch/launch-post.md`, then answer the first issues and Discussions promptly.

## Alpha gate

- [ ] Test the public install command from a clean machine on Node 22 or 24.
- [ ] Verify npm provenance on the published package and confirm no source maps reveal local paths.
- [ ] Run a one-week soft launch with a small group before a broad announcement; convert repeated confusion into docs or fixtures.
