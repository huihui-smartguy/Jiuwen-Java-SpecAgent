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
- At 1330px in English, the desktop navigation measured 577.62px and retained an 8.20px gap before the action controls with no document overflow.
- At 1329px, the desktop rail was hidden and the drawer trigger was shown.
- Clicked all seven English destinations; each active background was `rgb(235, 242, 255)`, every label fit its item, and `clientWidth` equaled `scrollWidth`.
- Chinese mode remained exactly seven 64px columns in a 496px rail.

## Deployment evidence

Status: pending release verification.

No credential, token, raw sensitive response, or password is recorded in this revision record.
