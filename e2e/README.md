# E2E oracle (Playwright + disposable PocketBase)

This is the migration's only success oracle. It serves the built Lynx **web** output in
headless Chromium against a **disposable** PocketBase and asserts the app boots, a
programmatic sign-in works, and a record created via the PB API appears live over SSE.

Every later layer ADDS specs tagged for its layer (`@l3`, `@l4`, ...). A layer's gate is
`typecheck` + `build` + that layer's tag + all previously-green tags still green.

## The disposable PocketBase (never the operator's data)

The suite runs a throwaway PocketBase, launched by `e2e/global-setup.ts`:

```
pb/pocketbase.exe serve --http 127.0.0.1:8091 \
  --dir .scratch/pb-e2e/pb_data-<timestamp> \
  --migrationsDir pb/pb_migrations \
  --hooksDir pb/pb_hooks
```

- **Port 8091** on purpose - NOT 8090, which is the operator's dev PocketBase. They must
  not collide.
- **`.scratch/pb-e2e/` is the ONLY mutable directory.** `pb/pb_data` (the operator's real
  personal data) is untouchable: never served, read, copied, or deleted.
- The data dir is built **fresh** from `pb/pb_migrations` on first serve (global-setup runs
  `pocketbase superuser upsert ... --dir <fresh> --migrationsDir pb/pb_migrations`, which
  applies the migrations, then creates the superuser).
- Schema (`pb/pb_migrations`) and hooks (`pb/pb_hooks`) are read-only inputs. The suite
  seeds only **records** (a superuser + one test user), never collections, so PocketBase's
  automigrate never writes a stray migration back into `pb/pb_migrations`.

## Credentials (generated at runtime, gitignored)

`global-setup` generates a random superuser and a random test app user each run and writes
them to `.scratch/pb-e2e/creds.json` (gitignored via `.scratch`). Credentials are **never**
inlined in committed files and **never** the operator's `.env.local`. The test user is
created via the SDK (as the superuser) and marked `verified: true` from the client - the
migration rules are never relaxed. The test user owns every record the specs create.

## How the web output is served

The Lynx web build emits `dist/main.web.bundle` - a web-decodable template, not a
standalone HTML page. It must be mounted inside a `<lynx-view>` from `@lynx-js/web-core` /
`@lynx-js/web-elements`. Playwright's `webServer` (see `playwright.config.ts`) therefore:

1. rebuilds the app bundle with `PUBLIC_PB_URL=http://127.0.0.1:8091` (so the app's PB
   client points at the disposable instance - `import.meta.env` is compile-time), then
2. serves the host page (`e2e/web-host/`) plus `dist/` on `http://127.0.0.1:4173`.

The app talks to PocketBase cross-origin; PocketBase's default CORS (`--origins *`) allows
it (proven in the Phase 0 spike). The Lynx app renders inside a shadow DOM, so the specs
deep-query element ids through shadow roots.

## The storage seam (ruling R11)

On the web target the Lynx app runs in a **Web Worker** with no `window`/`document`/
`localStorage`. The host page (`e2e/web-host/`) therefore registers a Lynx **NativeModule**,
`NativeStorageModule`, on the `<lynx-view>`:

- `lynx-view.nativeModulesMap = { NativeStorageModule: <blob esm url> }` - the worker imports a
  tiny proxy that forwards `getItem`/`setItem`/`removeItem` to the main thread;
- `lynx-view.onNativeModulesCall` - runs on the **main thread**, where `localStorage` exists,
  and performs the actual read/write.

The app's `src/lib/storage.ts` calls `NativeModules.NativeStorageModule` (async), with an
in-memory fallback + one `console.warn` if a host ever fails to register it. The PB origin is
passed to the app via `lynx-view.globalProps.pbUrl` (with `PUBLIC_PB_URL` as the build-time
override); no app code reads `window.location`.

**Sign-in seeding:** because the seam is backed by the host page's `localStorage`, the spec
performs a programmatic sign-in by writing the auth payload to `localStorage["pb_auth"]`
(the AsyncAuthStore key) once via `page.evaluate`, then reloading; the app hydrates the session
across the seam. A second reload (without re-seeding) proves the session persists.

## Run it

```
npm run build                 # emits dist/main.web.bundle (staged ladder: build precedes e2e)
npx -y playwright install chromium   # first run only
npx playwright test --grep @l1
```

`webServer` re-runs `npm run build` itself with the disposable PB URL, so the suite is
self-contained; the standalone `npm run build` above is the separate build gate.

## Reset to a clean slate

Stop the suite (global-teardown kills the serve process; an orphan pid is in
`.scratch/pb-e2e/pb.pid`). Do **not** hand-delete any data dir. For a clean slate, just run
again - `global-setup` always creates a NEW `.scratch/pb-e2e/pb_data-<timestamp>`.
