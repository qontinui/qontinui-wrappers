# @qontinui/wrapper-v0

UI Bridge wrapper for Vercel v0. API-primary with a Playwright fallback for
actions v0's public API does not cover.

## Actions

| Action                      | Transports              | Notes                                            |
| --------------------------- | ----------------------- | ------------------------------------------------ |
| `create-component`          | api, headless, headed   | POST /v1/components or drive the prompt UI       |
| `iterate-component`         | api                     | POST /v1/components/:id/iterations               |
| `export-code`               | api                     | GET /v1/components/:id/export                    |
| `list-recent`               | api                     | GET /v1/components?limit=N                       |
| `step-through-iterations`   | headless, headed        | Clicks `next iteration` control                  |
| `inspect-preview-state`     | headless, headed        | Reads preview iframe metadata                    |

Each action declares its supported transports. `registerHandlers(transport)`
only registers the actions that the transport can satisfy, and returns the
registered/skipped lists. A `NO_HANDLER` dispatch error is easier to
diagnose than a runtime crash deep inside an action handler that assumed a
different context.

> v0 API surface may change — the `/v1/*` paths above are based on the
> documented shape at time of writing. Re-check against Vercel's current
> docs if an action starts failing.

## Setup

```bash
cp .env.example .env
# Fill in V0_ACCESS_TOKEN.
# For Playwright-backed actions, also set V0_STORAGE_STATE_PATH to a
# pre-warmed storage state JSON created via:
#   npx playwright open --save-storage=./v0-storage.json https://v0.app
```

## Scripts

```bash
npm run build      # tsup (cjs+esm) + tsc (.d.ts)
npm run typecheck  # tsc --noEmit
npm run test       # vitest
```
