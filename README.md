# qontinui-wrappers

Reference UI Bridge wrappers. Each package here exposes semantic actions against
some third-party or legacy app through `@qontinui/ui-bridge-wrapper`'s transport
runtime, and serves as a working example for authoring your own wrappers.

For the concept, the scaffold CLI, and the transport decision rubric, see the
[wrapper authoring guide](../ui-bridge/docs/wrappers/authoring-guide.md).

## Packages

| Package                     | Transports              | One-liner                                                                |
| --------------------------- | ----------------------- | ------------------------------------------------------------------------ |
| `@qontinui/wrapper-gmail`   | `api`                   | Gmail REST — five actions (list-unread, search, get-thread, send-reply, archive). |
| `@qontinui/wrapper-v0`      | `api`, `headless`, `headed` | Vercel v0 — api-primary with a Playwright fallback for UI-only actions. |
| `@qontinui/_tsconfig`       | — (private)             | Shared `tsconfig.base.json` / `tsconfig.react.json`.                    |
| `@qontinui/_testing-harness`| — (private)             | `MockTransport` + `createMockContext` for wrapper tests.                |

`wrapper-gmail` is the **api-only teaching example** — the smallest possible
wrapper shape, useful for reading end-to-end in one sitting.

`wrapper-v0` is the **api + DOM fallback teaching example** and also a useful
product-iteration tool in its own right — it lets agents drive v0's prompt UI
for features the public API does not cover (e.g. `step-through-iterations`,
`inspect-preview-state`).

## Developing locally

This repo uses **npm workspaces**, not pnpm. The `pnpm-workspace.yaml` file is
intentionally preserved as a layout-only document; do **not** run `pnpm`
commands here — every `file:` dep spec (see individual package.json files) is
resolved by npm's algorithm, and pnpm will re-link them differently.

```bash
# From repo root:
npm install --legacy-peer-deps
npm run build      # turbo run build
npm run typecheck  # turbo run typecheck
npm run test       # turbo run test
```

`--legacy-peer-deps` is required because the reference wrappers declare
`@qontinui/ui-bridge` and `@qontinui/ui-bridge-wrapper` as peers and pull them
in via `file:../../../ui-bridge/packages/*`. npm 7+ otherwise objects to the
resulting duplicate peer graph.

### Working on a single package

```bash
cd packages/wrapper-gmail
npm run build
npm test
```

Turborepo handles inter-package build ordering when you invoke from the root.
Direct `cd` + `npm` works fine for single-package iteration.

### Clean rebuild

```bash
npm run clean
npm run build
```

## Contributing

This repo is a **maintained reference set**, not a catch-all. The wrappers
here exist to demonstrate patterns the runtime and CLI support. Community
wrappers should live in their own repositories under the `@qontinui/wrapper-*`
naming convention:

```
@qontinui/wrapper-<target-name>
```

For a new wrapper:

```bash
npx create-ui-bridge-wrapper <target-name>
```

Then publish to npm. A future "verified wrappers" program will curate
community entries that meet a quality bar (tests, docs, active maintainer) —
until then, consumers install at their own discretion.

### When to add a package here instead of your own repo

Add to `qontinui-wrappers` only if the wrapper:

- Illustrates a pattern not already covered (a new transport, a tricky auth
  flow, a non-trivial composition).
- Has a maintenance commitment from the core team.

Bug fixes, documentation improvements, and new tests for the existing two
wrappers are always welcome — open a PR.

## Repository layout

```
qontinui-wrappers/
├── package.json               # workspaces: ["packages/*"], npm-only
├── turbo.json
├── pnpm-workspace.yaml        # layout doc only — do not invoke pnpm
├── packages/
│   ├── _testing-harness/      # MockTransport, createMockContext
│   ├── _tsconfig/             # shared tsconfigs
│   ├── wrapper-gmail/         # api-only reference
│   └── wrapper-v0/            # api + browser fallback reference
└── README.md                  # this file
```
