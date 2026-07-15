# TestWise English Navigation Hotfix Revision Record

Date: 2026-07-15

Branch: `lalala/testwise-antigravity-r4`

Source baseline: `d9b16da0131ab6232d68bb5a698df0193ba5ca39` (`origin/develop` at implementation start)

## Reported issue

The seven desktop navigation items used fixed 64px columns. English labels such as `Overview` and `Knowledge` exceeded those boxes, which made the navigation rail appear cramped and left text outside the selected background.

## Implemented correction

- Preserved a 64px minimum for every desktop item while allowing English labels to grow to their intrinsic width.
- Added 8px horizontal inset inside each item so the active background fully contains its label.
- Kept the approved Chinese navigation geometry unchanged at seven 64px columns and a 496px rail.
- Moved the shared shell handoff from 1319px to 1329px so the expanded English rail retains at least an 8px gap from the right-side controls.
- Kept the Tasks `Change Object` focus behavior aligned with the same responsive handoff.

## Verification

- Targeted AppShell regression suite: 18/18 tests passed.
- Full automated suite: 16 test files and 142/142 tests passed.
- `VITE_BASE_PATH=/testwise/ npm run build`: TypeScript and Vite production build passed.
- `git diff --check`: passed with no whitespace errors.
- At 1330px in English, the desktop navigation measured 577.62px and retained an 8.20px gap before the action controls with no document overflow.
- At 1329px, the desktop rail was hidden and the drawer trigger was shown.
- Clicked all seven English destinations locally; each active background was `rgb(235, 242, 255)`, every label fit its item, and `clientWidth` equaled `scrollWidth`.
- Chinese mode remained exactly seven 64px columns in a 496px rail.

## Deployment evidence

Status: atomically deployed and verified.

- Deployed source commit: `f129efaaa24e8c4cfd3039f09127aade793edc10`
- Release path: `/data1/testwise/releases/20260715-092046-f129efa`
- Artifact SHA-256: `940e843e1495fc5b5b21c680f03468bedcb39fbd682c2a18ebdca55367f5731c`
- Previous release / rollback target: `/data1/testwise/releases/20260715-084123-b8e99d7`
- Nginx configuration validation passed before and after the atomic symlink switch; the backend remained listening on port 3000.
- Production runtime returned 200 with `apiBaseUrl: /testwise/api`, `deploymentMode: process`, `defaultLanguage: zh`, and `enableMockFallback: false`.
- Production feature discovery returned 200 with 15 features through the `/testwise/api` proxy.
- Production loaded `/testwise/assets/index-Cyj1rBeh.css` and `/testwise/assets/index-Beg38RAR.js` from the new release.
- At the live 1330px boundary, the English rail measured 577.45px with an 8.28px control gap and no overflow; at 1329px, the drawer layout was active.
- Clicked all seven live English navigation options. The empty-session Observe guard correctly redirected to Tasks; every reachable active destination fully contained its selected label.
- Deployment timestamp (Asia/Shanghai): `2026-07-15 09:20:46 CST`

No credential, token, raw sensitive response, or password is recorded in this revision record.
