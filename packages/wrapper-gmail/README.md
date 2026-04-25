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
# and GMAIL_REFRESH_TOKEN. See "Getting credentials" below.
```

## Getting credentials

1. **Create a Google Cloud OAuth client.** In the [Google Cloud
   Console](https://console.cloud.google.com/), create (or pick) a
   project, enable the Gmail API, and add an OAuth 2.0 Client ID of type
   **Desktop application**. Google's
   [OAuth desktop guide](https://developers.google.com/identity/protocols/oauth2/native-app)
   covers the console steps in detail; we don't reproduce them here.

2. **Set the client id + secret in your environment.** Copy
   `.env.example` to `.env` and fill in the two values from the credential
   you just created:

   ```env
   GMAIL_OAUTH_CLIENT_ID=...
   GMAIL_OAUTH_CLIENT_SECRET=...
   ```

3. **Run the loopback setup script** to mint a refresh token. The
   credentials must already be exported in your shell — the script reads
   them from `process.env` (it does not load `.env` itself):

   ```bash
   # from the repo root
   set -a; . packages/wrapper-gmail/.env; set +a   # POSIX shells
   pnpm --filter @qontinui/wrapper-gmail exec gmail-oauth-setup
   ```

   PowerShell equivalent:

   ```powershell
   Get-Content packages/wrapper-gmail/.env | ForEach-Object {
     if ($_ -match '^([^=#]+)=(.*)$') { Set-Item "env:$($Matches[1])" $Matches[2] }
   }
   pnpm --filter @qontinui/wrapper-gmail exec gmail-oauth-setup
   ```

   The script picks an ephemeral loopback port, prints the consent URL
   (and best-effort opens it in your browser), waits for Google to
   redirect to `http://127.0.0.1:<port>/oauth/callback`, exchanges the
   auth code for tokens, and prints the refresh token in
   copy-pasteable form.

4. **Paste `GMAIL_REFRESH_TOKEN` into `.env`.** That's it — the wrapper
   is now ready and `auth.ts` will pick the value up at runtime.

The script always re-prompts for consent (`prompt=consent`) so each run
mints a fresh refresh token; the previous one keeps working until you
revoke it at <https://myaccount.google.com/permissions>.

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
