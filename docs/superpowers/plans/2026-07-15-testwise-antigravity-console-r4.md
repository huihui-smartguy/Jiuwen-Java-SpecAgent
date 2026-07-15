# TestWise Antigravity Console R4 Implementation Plan

> **For Codex:** REQUIRED SKILL: Use superpowers:subagent-driven-development to execute this plan task-by-task, with superpowers:test-driven-development for every behavior or contract change and superpowers:verification-before-completion before any completion claim.

**Goal:** Implement the user-approved TestWise Antigravity Console Figma across all seven routes without adding unapproved UI or changing live API behavior, then publish the complete `DispatchPlatform` on `develop` and atomically deploy it under `/data1/testwise`.

**Architecture:** Keep the existing React route/data architecture and make presentation changes at the narrowest layer: one shared shell/header, shared design tokens and primitives, then route-scoped CSS. Treat the approved Figma nodes as the visual source of truth; preserve Object selection, language state, route focus restoration, drawer accessibility, API calls, polling, cancellation, runtime configuration, and the `/testwise/` base path.

**Tech Stack:** React 19, TypeScript, React Router, Vite, Vitest, Testing Library, CSS, Nginx process deployment.

**Approved Figma nodes:** Overview `23:2`; Tasks `40:4`; Observe `40:108`; Results `40:212`; Scripts `40:316`; Knowledge `40:420`; Settings `40:524`.

**Precedence:** Approved R4 Figma nodes → this plan → older R2 design notes/plans → current presentation. No unapproved embellishments.

---

### Task 1: Implement the approved shared header and ghost brand

**Files:**
- Create: `DispatchPlatform/src/components/GradientGhostLogo.tsx`
- Modify: `DispatchPlatform/src/components/ConsoleHeader.tsx`
- Modify: `DispatchPlatform/src/AppShell.test.tsx`
- Modify: `DispatchPlatform/src/i18n.ts`
- Modify: `DispatchPlatform/src/styles/shell.css`
- Delete: `DispatchPlatform/src/components/FairySparkLogo.tsx`

**Step 1: Write failing shell contract tests**

Update `AppShell.test.tsx` to require:
- the exact ghost accessible name and no Fairy/Gemini spark;
- Chinese navigation `总览 / 任务 / 观测 / 结果 / 脚本 / 知识 / 设置` and English navigation after language switching;
- only the selected Object identity plus chevron in the visible global selector, with no visible version, live label, health label, or status dot;
- preserved Object selection behavior, drawer focus trap, Escape, route activation, and account interaction;
- the R4 CSS contract: 72px header; centered 496px navigation track; 15px navigation; 44px controls; 216px Object selector; 32px ghost; responsive drawer breakpoint before the desktop tracks collide.

**Step 2: Run the focused test and confirm it fails for the old contract**

Run: `npx vitest run src/AppShell.test.tsx`
Expected: FAIL because the old implementation uses an English-only 64px shell, a Gemini-style spark, and visible status/version metadata.

**Step 3: Implement the minimal header change**

- Create a code-native 32×32 ghost SVG using the exact approved Figma paths and five-stop gradient.
- Localize the seven navigation labels through the existing language state.
- Use symmetric desktop side tracks around the centered navigation group.
- Keep the native transparent Object select and all existing focus/accessibility mechanics.
- Show `selectedObject.product + selectedObject.scene`; keep version/status in the runtime data contract and Settings only.
- Preserve the responsive drawer, moving its breakpoint only as needed to avoid collisions.
- Change the Chinese Settings title to `设置`; preserve the approved Observe title `执行观测`.

**Step 4: Run the focused test and confirm it passes**

Run: `npx vitest run src/AppShell.test.tsx`
Expected: PASS.

**Step 5: Review and checkpoint**

- Dispatch a fresh task reviewer against the Task 1 brief and diff.
- Address only findings that are required by Figma, accessibility, or preserved behavior.
- Run `git diff --check` and commit the reviewed task.

### Task 2: Establish R4 foundations and match Overview and Tasks

**Files:**
- Modify: `DispatchPlatform/src/styles/foundations.css`
- Modify: `DispatchPlatform/src/styles/primitives.css`
- Modify: `DispatchPlatform/src/styles/routes/overview.css`
- Modify: `DispatchPlatform/src/styles/routes/tasks.css`
- Modify: `DispatchPlatform/src/pages/Dashboard.test.tsx`
- Modify: `DispatchPlatform/src/pages/Tasks.test.tsx`
- Modify only if required by exact approved copy/structure: `DispatchPlatform/src/pages/Dashboard.tsx`
- Modify only if required by exact approved copy/structure: `DispatchPlatform/src/pages/Tasks.tsx`

**Step 1: Write failing geometry and typography contracts**

Require the shared 1296px content rail at 1440px, 72px page sides, 44px H1 hierarchy, 24px card radii, and the exact approved Overview/Tasks grid proportions, gaps, control sizes, and section heights. Keep behavioral assertions for live task creation, polling, cancellation, object scoping, and empty/loading/error states unchanged.

**Step 2: Prove the tests fail under the compressed R2 presentation**

Run: `npx vitest run src/pages/Dashboard.test.tsx src/pages/Tasks.test.tsx`
Expected: FAIL on old rail, type scale, card radius, gaps, and route geometry.

**Step 3: Implement CSS-first visual alignment**

- Update shared tokens/primitives once.
- Match Overview execution strip, 404/868 composition, metrics, path, recent activity, and attention card.
- Match Tasks 856/416 composition, filter/creation panel, active task panel, and table.
- Do not add content or controls absent from Figma.
- Retain semantic controls, visible focus, minimum 44px targets, reduced-motion behavior, and contained tables.

**Step 4: Verify focused and shell regression tests**

Run: `npx vitest run src/pages/Dashboard.test.tsx src/pages/Tasks.test.tsx src/AppShell.test.tsx`
Expected: PASS.

**Step 5: Review and checkpoint**

Dispatch a fresh reviewer, resolve in-scope findings, run `git diff --check`, and commit.

### Task 3: Match Observe, Results, and Scripts to their approved frames

**Files:**
- Modify: `DispatchPlatform/src/styles/routes/observe.css`
- Modify: `DispatchPlatform/src/styles/routes/results.css`
- Modify: `DispatchPlatform/src/styles/routes/scripts.css`
- Modify: `DispatchPlatform/src/pages/Observation.test.tsx`
- Modify: `DispatchPlatform/src/pages/Results.test.tsx`
- Modify: `DispatchPlatform/src/pages/Scripts.test.tsx`
- Modify route TSX only if exact approved Figma structure/copy requires it.

**Step 1: Replace obsolete visual assertions with R4 contracts**

Require each route’s exact 1296px composition, 24px gaps/radii, approved type hierarchy, control sizing, metric heights, table sizing, and split ratios. Preserve all existing API, filtering, logging, report, loading, empty, and failure behavior tests.

**Step 2: Prove the tests fail**

Run: `npx vitest run src/pages/Observation.test.tsx src/pages/Results.test.tsx src/pages/Scripts.test.tsx`
Expected: FAIL on old compressed dimensions.

**Step 3: Implement the three route presentations**

- Observe: approved `执行观测` header, four metrics, full-width execution path, and 856/416 live-console split.
- Results: four metrics, approved 7/5 analytics split, and reports table.
- Scripts: approved summary cards, filter/search controls, and six-column table.
- Preserve current live data derivation and mark presentation-only controls consistently.

**Step 4: Verify focused and regression tests**

Run: `npx vitest run src/pages/Observation.test.tsx src/pages/Results.test.tsx src/pages/Scripts.test.tsx src/AppShell.test.tsx`
Expected: PASS.

**Step 5: Review and checkpoint**

Dispatch a fresh reviewer, resolve in-scope findings, run `git diff --check`, and commit.

### Task 4: Match Knowledge and Settings to their approved frames

**Files:**
- Modify: `DispatchPlatform/src/styles/routes/knowledge.css`
- Modify: `DispatchPlatform/src/styles/routes/settings.css`
- Modify: `DispatchPlatform/src/pages/Knowledge.test.tsx`
- Modify: `DispatchPlatform/src/pages/SettingsPage.test.tsx`
- Modify route TSX only if exact approved Figma structure/copy requires it.

**Step 1: Write failing R4 contracts**

Require the exact Knowledge search/collection/update/gap composition and Settings sections, rows, controls, and card geometry. Preserve Knowledge search behavior, Settings Object/language behavior, local preferences, connection check, read-only runtime values, API copy, and presentation-only save semantics.

**Step 2: Prove the tests fail**

Run: `npx vitest run src/pages/Knowledge.test.tsx src/pages/SettingsPage.test.tsx`
Expected: FAIL on old gradients, fixed compressed heights, typography, and spacing.

**Step 3: Implement minimal route styling**

Match the approved Figma without introducing new cards, controls, copy, gradients, or decoration.

**Step 4: Verify focused tests**

Run: `npx vitest run src/pages/Knowledge.test.tsx src/pages/SettingsPage.test.tsx src/AppShell.test.tsx`
Expected: PASS.

**Step 5: Review and checkpoint**

Dispatch a fresh reviewer, resolve in-scope findings, run `git diff --check`, and commit.

### Task 5: Perform full functional, visual, and responsive QA

**Files:**
- Create: `DispatchPlatform/docs/revision-records/2026-07-15-testwise-antigravity-console-r4.md`
- Modify tests/styles only when QA reveals a verified Figma or accessibility mismatch.

**Step 1: Run automated verification**

Run:
- `npm run test:run`
- `npm run build`
- `VITE_BASE_PATH=/testwise/ npm run build`
- `git diff --check`

Expected: 130+ tests pass, both builds succeed, and no whitespace errors.

**Step 2: Start the subpath preview and capture all approved routes**

At 1440×1100, capture and inspect Overview, Tasks, Observe, Results, Scripts, Knowledge, and Settings. Compare header, rails, typography, card geometry, spacing, control states, and visible copy with the exact Figma nodes.

**Step 3: Exercise every navigation option and interaction boundary**

- Click every desktop navigation item and confirm URL, one active state, title, shared header, and no console errors.
- Switch Chinese/English and verify navigation localization.
- Change Object and confirm page scoping without selector health/version metadata.
- Exercise the responsive drawer, focus trap, Escape, and route focus restoration.

**Step 4: Responsive and accessibility QA**

Inspect at 1319, 1024, 768, and 390 widths. Confirm no horizontal page overflow, no header collision, contained tables, minimum targets, keyboard focus visibility, semantic labels, contrast, and reduced motion.

**Step 5: Record evidence**

Write the immutable R4 revision record with Figma node matrix, baseline, implementation summary, preserved behavior, presentation-only boundary, exact automated results, visual/click-through evidence, known limitations, sanitized deployment evidence placeholder, and commit range. Do not include credentials or sensitive responses.

**Step 6: Dispatch final code review**

Use `superpowers:requesting-code-review` with the full commit range. Resolve verified blockers and rerun the complete verification suite.

### Task 6: Publish the reviewed repository to `develop`

**Files:**
- No new product files unless final verification finds a defect.

**Step 1: Confirm publish scope**

Run `git status --short`, `git diff --stat origin/develop...HEAD`, and review every commit. Ensure only the intended `DispatchPlatform` changes are included.

**Step 2: Verify immediately before publishing**

Use `superpowers:verification-before-completion` and repeat the full suite from Task 5.

**Step 3: Integrate and push**

Following `superpowers:finishing-a-development-branch` and the GitHub publication workflow, update `develop` only if it still has the expected remote base, then push the reviewed commit range to `origin/develop`. Do not force-push.

**Step 4: Verify GitHub state**

Confirm `origin/develop` resolves to the expected final commit and the repository tree contains the updated `DispatchPlatform` and revision record.

### Task 7: Atomically deploy the verified artifact to `/data1/testwise`

**Files:**
- Server release directory only; do not edit source after GitHub publication.

**Step 1: Prepare the immutable artifact**

Build last with `VITE_BASE_PATH=/testwise/`, assert asset URLs use `/testwise/`, create a checksum-addressed archive, and record the final commit SHA.

**Step 2: Run read-only server gates**

Inspect the current `/data1/testwise/current` target, permissions, free disk, Nginx include/effective config, backend listener/health, current production `config/runtime.json`, and rollback target. Do not expose credentials or raw sensitive output.

**Step 3: Stage a new release**

Create `/data1/testwise/releases/<timestamp>-<short-sha>`, extract only into that new directory, preserve the current reviewed production runtime configuration, and assert:
- `apiBaseUrl === "/testwise/api"`;
- `enableMockFallback === false`;
- expected live Object identities and backend route.

Match the existing Nginx-readable ownership and permissions.

**Step 4: Validate and switch atomically**

Run `nginx -t`, create a temporary symlink to the new release, and atomically replace `current`. Reload Nginx only if configuration changed.

**Step 5: Smoke test and rollback on failure**

Verify `/testwise/`, all seven SPA refresh routes, runtime configuration, hashed JS/CSS content types, and read-only feature/script APIs. Do not issue POST/DELETE smoke requests. If any check fails, atomically restore the recorded previous symlink and repeat validation.

**Step 6: Complete the revision record**

Add sanitized release path, deployed commit, checksum, smoke results, rollback target, and deployment timestamp; if this documentation update occurs after the first push, commit and push it as a final documentation-only change and ensure deployed source SHA remains explicit.
