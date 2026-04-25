# @qontinui/wrapper-v0

UI Bridge wrapper for Vercel v0. API-primary with a Playwright fallback for
actions v0's public API does not cover.

## Actions

| Action                      | Transports              | Endpoint / Notes                                                |
| --------------------------- | ----------------------- | --------------------------------------------------------------- |
| `create-component`          | api, headless, headed   | `POST /v1/chats`                                                |
| `iterate-component`         | api                     | `POST /v1/chats/:chatId/messages` (returns ChatDetail)          |
| `export-code`               | api                     | `GET /v1/chats/:chatId/versions/:versionId` (files inline)      |
| `download-component`        | api                     | `GET /v1/chats/:chatId/versions/:versionId/download` (binary)   |
| `list-recent`               | api                     | `GET /v1/chats?limit=N`                                         |
| `step-through-iterations`   | headless, headed        | Clicks `next iteration` control                                 |
| `inspect-preview-state`     | headless, headed        | Reads preview iframe metadata                                   |

Each action declares its supported transports. `registerHandlers(transport)`
only registers the actions that the transport can satisfy, and returns the
registered/skipped lists. A `NO_HANDLER` dispatch error is easier to
diagnose than a runtime crash deep inside an action handler that assumed a
different context.

The action contracts use `componentId` and `iterationId` as parameter names
for backward compatibility — internally these are v0's `chatId` and
`versionId`. Each action file's header comment documents the mapping.

> v0 API surface evolves — paths above reflect the OpenAPI spec at
> `https://api.v0.dev/v1/openapi.json` as of 2026-04-25. If an action
> starts failing with 404, re-check against the current spec; the
> migration from `/v1/components` to `/v1/chats` (early 2026) is the kind
> of churn this wrapper has to track.

## Gotchas

**OpenAPI spec ≠ live behavior.** v0's spec lists multiple response
formats for `chats.downloadVersion` (`application/zip` and
`application/gzip`), but the live endpoint always returns zip today —
`Accept: application/gzip` is silently ignored, `?format=gzip` query
returns 422. The `download-component` action accepts a `format` parameter
as an Accept hint for forward-compat, but **`result.format` reflects the
server's actual Content-Type, not the request**. So `format: 'gzip'`
today returns `{ format: 'zip', ... }` — truthful instead of misleading.
If v0 starts honoring gzip in the future, the wrapper picks it up
automatically via Content-Type. Verify-don't-trust applies to any
spec-documented capability you haven't probed live.

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
