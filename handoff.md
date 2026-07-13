# Handoff

Running status for in-flight work. Read this before resuming. Newest session on top.

---

## 2026-07-12 — Hermes Agent harness + `~/` path display

### What shipped (done, validated, verified live)

- **Settings "Harness roots" no longer show `/skills`.** The label showed the managed
  *skills* root (e.g. `~/.claude/skills`); it now shows the harness root the app writes into.
  Done in the backend presenter (`skill_manager/application/settings/presenters.py`,
  `_harness_root_display` → `managed_location.parent`). The kernel's real `managed_location`
  is unchanged (the skills adapter and tests depend on it).
  - Note: Codex's skills root is `~/.agents/skills`, so it displays as `~/.agents` (a shared
    cross-harness dir), not `~/.codex`. That's the honest result of dropping `/skills`.

- **`~/` home abbreviation across all path displays.** Absolute home paths render as `~/…`
  everywhere: Settings storage + harness roots, MCP config paths, slash written/review paths,
  skill-detail locations. Implemented as a **frontend display-only** concern so API values stay
  absolute (keys, matching, and the MCP config-choice round-trip are unaffected):
  - `frontend/src/lib/paths/` — `formatHomePath()` util (+ test), `useFormatPath()`/`useHomeDir()`,
    `HomeDirContext` + `HomeDirProvider` (mounted in `App.tsx`, inside QueryClientProvider).
  - Home source: `homeDir` added to `GET /api/health` (`skill_manager/api/routers/health.py`).
  - `useHomeDir` reads context (default `null`), so path-displaying components still render in
    tests without a QueryClient — paths just pass through unabbreviated.

- **Hermes Agent added as a harness** (`skill_manager/harness/catalog.py`), CLI probe `hermes`,
  root `~/.hermes`. It is **catalog-driven, so it flows app-wide**, not settings-only. Verified
  live: appears in Settings, Skills inventory/detail, MCP inventory columns, and slash targets.
  - Skills: `~/.hermes/skills` (env override `SKILL_MANAGER_HERMES_ROOT`).
  - MCP: `~/.hermes/mcp.json`, subtree `mcpServers`, codec `hermes`
    (`HermesMapper(_TypedMcpServersMapper)` in `skill_manager/application/mcp/mappers.py`).
  - Slash: `~/.hermes/commands`, frontmatter Markdown. **Required extending the closed slash
    allowlist** — `SlashTargetId` Literal (backend `models.py` + `api/schemas/slash_commands.py`,
    frontend `api/types.ts`) and `TARGET_ORDER` in `slash_commands/targets.py`. This gap silently
    dropped Hermes from slash targets until fixed; regenerated `openapi.json`/`generated.ts`.
  - Logo: `assets/harness-logos/hermes-logo.svg` (+ `frontend/src/assets/...`), from lobehub,
    re-filled `#7d8590` (theme-neutral; logos render as `<img>` so `currentColor` won't inherit).

- Validation: `npm run typecheck`, `bash scripts/test_backend.sh` (300 + 127), `npm test` (269),
  `npm run build`, `npm run codegen:openapi` — all green.

### ⚠️ Incomplete — resume here

1. **Hermes hooks — NOT implemented (the main open item).** Hermes has no `hooks` binding, so it
   is correctly absent from the Hooks views. Deferred because hook config formats are
   harness-specific (each harness has its own event taxonomy + file shape) and Hermes' real
   schema is unknown. Reusing another harness's hook codec would write structurally-wrong config.
   **To finish:** obtain Hermes' actual hooks schema (event names, config file path, JSON/TOML
   shape), then add a `HookMapper` in `skill_manager/application/hooks/mappers.py` + register it,
   and add a `hooks` `ConfigSubtreeBindingProfile` to the Hermes entry in `catalog.py`.

2. **Hermes MCP + slash conventions are UNVERIFIED assumptions.** `~/.hermes/mcp.json`
   (`mcpServers` shape) and `~/.hermes/commands` (frontmatter Markdown) follow common
   cross-vendor conventions but have **not** been checked against a shipping Hermes build. If
   Hermes differs, correct the resolvers/codec in `catalog.py` (and `HermesMapper` if the MCP
   shape differs).

3. **Hermes permissions — no binding** (not requested). Add a `permissions`
   `ConfigSubtreeBindingProfile` + a `PermissionMapper` if/when wanted.

4. **Hermes not installed locally** → its skills/MCP/slash adapters have never run against a real
   Hermes install. Behavior is exercised only via the catalog wiring and unit/integration tests
   with a fake home. Validate against a real `hermes` CLI before trusting writes.

### Housekeeping

- **Nothing is committed.** Changes are in the working tree on `main`. Per `CLAUDE.md`, land via a
  short-lived branch off `main` → merge back → delete. Run the full validation suite before commit.
- **Restart the running instance** to pick up backend changes; `frontend/dist` is already rebuilt.
- `README.md` updated (Hermes row + provisional footnote). `README.zh-CN.md` was **removed** from
  this fork (not needed); its link was dropped from `README.md`.
