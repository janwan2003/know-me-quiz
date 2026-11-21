# Knowsies

Free “How well do you know me?” quiz maker. Answer questions about yourself, share one link, and see who knows you best on a live leaderboard. No accounts, no ads; quizzes are deleted after 90 days.

- App: https://pb-know-me-quiz.pages.dev
- Product, privacy and support page: https://janwan2003.github.io/know-me-quiz/

## Stack

Cloudflare Pages (static files in `public/`) + Pages Functions (`functions/`) + D1 (`schema.sql`). No build step.

- `functions/api/[[path]].js`: the JSON API (create, take one answer at a time, leaderboard, owner tools, reports, per-IP rate limits).
- `functions/q/[id].js`: the quiz page with a live link preview (“N friends played · top score x/10”).
- `functions/_lib.js`: validation, word filter, scoring, ranking.
- `public/bank.js`: 150 original questions in 5 packs.

## Develop and test

```sh
npx pnpm@9 install
npx wrangler d1 execute pb-know-me-quiz --local --file schema.sql
npx wrangler pages dev public --port 8823
node --test tests/unit/          # unit tests
node tests/e2e/run.mjs           # e2e in real Chromium against BASE (default http://localhost:8823)
BASE=https://pb-know-me-quiz.pages.dev node tests/e2e/run.mjs   # against production (cleans up after itself)
node tools/render-images.mjs     # og.png and icons
```

Deploy: `npx wrangler pages deploy public --project-name pb-know-me-quiz --branch main`.
