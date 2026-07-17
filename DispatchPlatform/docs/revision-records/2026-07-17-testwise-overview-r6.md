# TestWise Overview R6

- Date: 2026-07-17
- Source baseline: `a5498693ef601305f8f16fa094638a5e2147252f` (`origin/develop`)
- Scope: `DispatchPlatform` Overview page only
- Design approval: R6 approved by the user on 2026-07-17
- Figma, Basic/selector state: [node 80:2](https://www.figma.com/design/dZShT2fYtwd9cCYCXpYGAA/TestWise-Antigravity-Console-Demo?node-id=80-2)
- Figma, Performance state: [node 80:188](https://www.figma.com/design/dZShT2fYtwd9cCYCXpYGAA/TestWise-Antigravity-Console-Demo?node-id=80-188)

## Purpose

R6 restructures the Overview into an object-level L0 quality summary and a single L1 dimension workspace. The page is intended to support a complete first-pass quality judgment without mixing obsolete activity, follow, or execution-path content into the quality hierarchy.

## User-visible changes

1. Replaced the former daily metric row with one integrated `L0 QUALITY · OBJECT` card:
   - Total Execution
   - Overall Pass Rate
   - Total Issues
2. Replaced the Overview Execution Path with `L1 QUALITY · DIMENSION VIEW`.
3. Added one L1 detail card with an accessible four-option dimension selector:
   - Basic Functionality
   - DFX
   - Scenario-based
   - Performance
4. Basic Functionality, DFX, and Scenario-based display passed scripts, overall quality assessment, and issues found.
5. Performance displays P95 trend data for six versions and a current-version versus performance-baseline comparison.
6. Removed Recent Activities and Follow/Attention sections from Overview.
7. Kept the current-execution strip because it is independent of the removed historical Execution Path.
8. Updated the Overview subtitle to the professional description `对象级 L0 质量总览与 L1 分维度测试执行分析`.
9. Kept Create Task on one line at `120 × 52 px` on desktop and responsive layouts.

## Frontend mock-data contract

The current TestWise backend does not expose L1 quality dimensions, issue severity by dimension, performance latency, version trend, or baseline-comparison contracts. R6 therefore renders a deterministic, Overview-scoped frontend data model from `src/data/overviewMockData.ts`.

- The quality values do not depend on `enableMockFallback`.
- Overview does not request `/statistics/summary`.
- Mock-backed quality content is visibly disclosed as `演示数据 · 前端模拟`.
- The current-execution strip remains connected to the existing active-task state and does not fabricate live production activity.

Reference values:

- L0: 134 total executions, 67.91% overall pass rate, 42 total issues.
- Basic Functionality: 91/134 passed, rating B, 7 issues.
- DFX: 118/134 passed, rating A-, 5 issues.
- Scenario-based: 104/134 passed, rating B+, 9 issues.
- Performance: 86/134 passed, rating A-, 4 issues, P95 412 ms.
- Performance trend: v1.0 through v1.5.
- Baseline comparison: v1.5 at 412 ms versus v1.2 at 450 ms; improvement 38 ms / -8.4%.

## Implementation details

- Refactored `src/pages/Dashboard.tsx` around the L0/L1 hierarchy.
- Added `src/data/overviewMockData.ts` for deterministic presentation data.
- Rebuilt Overview route styling while preserving shared metric-card and presentation-button rules used by other routes.
- Added a custom listbox selector with Arrow Up/Down, Home/End, Enter/Space, Escape, outside-click, focus-return, and selected-state behavior.
- Added an accessible inline SVG trend chart without introducing a chart dependency.
- Added Chinese and English Overview-specific copy without repurposing shared Results or Observation translation keys.
- Replaced obsolete Overview tests and updated AppShell hierarchy assertions.

## Responsive and accessibility verification

- Desktop geometry verified at 1440 × 1100 against the approved Figma frames.
- Exact responsive checks completed at 1179 × 1100, 768 × 1100, and 390 × 844.
- No document-level horizontal overflow at any checked width.
- Create Task remains one line and measures 120 × 52 px at every checked width.
- The four-option selector remains inside the viewport when open.
- Small-screen flex bases and L1 grid rows are explicitly reset so the action, mock badge, selector, and first metric cannot stretch or overlap.
- Overview quality rendering produced no `/api/` resource request during local production-preview checks.

## Verification commands

```text
npm run test:run
npm run build
VITE_BASE_PATH=/testwise/ npm run build
git diff --check
```

## Deployment and rollback

The production release must be staged beneath `/data1/testwise/releases`, preserve the live `config/runtime.json` byte-for-byte, and atomically switch `/data1/testwise/current`. If runtime, route, asset, console, or interaction checks fail, switch `current` back to the captured previous release target.

## Deployment evidence

Pending production rollout. Sanitized release identifiers, hashes, runtime-preservation proof, and smoke-test results will be appended after deployment.
