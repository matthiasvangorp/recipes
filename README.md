# Dinners

Weekly dinner recipes, published at https://recipes.homekit-products.eu.

- `recipes/*.json` — one file per recipe. `cooked` is `null` until it's made, then a `YYYY-MM-DD` date.
- `build.mjs` — zero-dependency build: `node build.mjs` → `dist/`.
- `functions/api/cooked.js` — Cloudflare Pages Function behind the "Cooked it" button; commits the `cooked` date back to this repo.
- `site.config.json` — site title and the two people the macros are split between.
- `dist/recipes.json` — machine-readable list of recipes and cooked status.

## Cloudflare Pages setup

1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick this repo.
2. Build settings: framework preset **None**, build command `node build.mjs`, output directory `dist`.
3. Settings → Variables and Secrets (Production), add as **encrypted**:
   - `COOK_KEY` — any passphrase; the site asks for it the first time you tap "Cooked it".
   - `GITHUB_TOKEN` — fine-grained personal access token, repository access: only this repo, permission **Contents: Read and write**.
   - `GITHUB_REPO` — `matthiasvangorp/recipes`
4. Redeploy so the variables take effect.
5. Custom domains → add `recipes.homekit-products.eu`.
