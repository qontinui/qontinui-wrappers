# @qontinui/wrapper-gmail

Api-only UI Bridge wrapper for Gmail. Exposes five semantic actions:

| Action        | Params                                     | Result                              |
| ------------- | ------------------------------------------ | ----------------------------------- |
| `list-unread` | `{ limit?: number, query?: string }`       | `{ messages: MessageSummary[] }`    |
| `search`      | `{ query: string, limit?: number }`        | `{ messages: MessageSummary[] }`    |
| `get-thread`  | `{ threadId: string }`                     | `{ thread: ThreadDetail }`          |
| `send-reply`  | `{ threadId: string, body: string }`       | `{ id, threadId }`                  |
| `archive`     | `{ messageId: string }`                    | `{ success: true }`                 |

Each action is wrapped in `withRetry({ attempts: 3, baseMs: 250 })` and
`withAuthRefresh` so transient failures and expired access tokens recover
automatically.

## Setup

```bash
cp .env.example .env
# Fill in GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET,
# and GMAIL_REFRESH_TOKEN. See "Provisioning a refresh token" below.
```

## Provisioning a refresh token

Two options:

1. **Google Cloud console** — easiest for a one-off. Create an OAuth 2.0
   Client (desktop application), mint a refresh token via the OAuth
   Playground or `gcloud auth application-default login`, and paste it
   into `.env`.

2. **Loopback flow helper** (TBD) — run `node dist/scripts/oauth-setup.js`.
   The script opens the consent URL in a browser and captures the code via
   a temporary local HTTP server on `127.0.0.1:<ephemeral>/oauth/callback`.
   This script is not implemented in the current phase — `src/auth.ts`
   throws a clear error pointing here. See `runInteractiveOAuthFlow` for the
   stub.

## Entry points

- **React** (`@qontinui/wrapper-gmail`): default export `GmailWrapper`.
  Renders `<WrapperAppShell>` and registers the component with UI Bridge.
- **Node** (`@qontinui/wrapper-gmail/node`): spins up the transport and
  parks on SIGINT. No React imports.

## Scripts

```bash
npm run build      # tsup (cjs+esm) + tsc (.d.ts)
npm run typecheck  # tsc --noEmit
npm run test       # vitest
```
