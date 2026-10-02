# Advice experience update

## Interaction

Get advice opens one contained workspace, with three stages:

1. Choose a focus: select a suggested question or write your own; inspect the context included before generating.
2. Explore advice: all returned sections and introductory text remain available, including unfamiliar headings from different models. Choose an idea without changing the draft.
3. Make it yours: edit the text, choose its destination, see the existing text that will be preserved, and append to the draft.

The entry editor remains mounted but hidden, preserving unsaved edits. Advice stays available when returning to the editor and reopening within the same session. Last AI additions share the editor's field-aware undo. Saving the entry remains explicit.

Header and footer stay visible while the body scrolls. One responsive dialog replaces the previous independent fixed-width panels and nested field-selection popup. Keyboard focus is contained and restored on close. Closing/canceling aborts the request; late responses cannot update a newer session. Loading, retry, empty responses and truncation have explicit states.

## Backend and context

The optional `advisorQuestion` is limited to 1,500 characters and appended to both configured and built-in prompts. Goal fallback now uses the goals prompt, rather than the skills prompt. Unsaved skills and mentee entries are merged into `boardData.you` correctly; their saved counterparts are not mutated. Skill-specific fields also reach the skills prompt. Browser authentication uses the existing shared activation flow and continues the requested generation after activation.

## Verification

- 46 tests passed: 24 Jest/helper tests and 22 Node backend tests.
- Production build succeeded.
- Browser: chose a focus, generated sample advice, edited an idea, appended to notes, returned to editor, verified the field, undid the addition, and reopened retained advice. No board save was performed during this test.
- Phone viewport 390×700: dialog 374×684 at an 8px top margin, footer bottom 692px; scrolled to the final advice item and opened its editor. Both footer actions remained visible.
- No application console errors in the tested flow.
- Local fixture responses only; actual model quality and updated backend behavior remain deployment checks. No deployment or commit performed.
