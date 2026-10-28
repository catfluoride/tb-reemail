# tb-reemail v0.5.1 — experimental

Completes the existing direct **Email reminder…** workflow for writable CalDAV event calendars:

- Carry recipients, lead time, subject and message into **Custom…**, so a popup alarm can be added without losing the email alarm.
- Reject blank, fractional, negative and out-of-range lead times. Explicit zero still means at event start.
- Keep invalid drafts open when Save is chosen from the close prompt; allow Discard and Cancel.
- Prevent native DISPLAY reminders from matching the EMAIL shortcut as a numeric preset.
- Build the XPI reproducibly from current source, run regression tests, verify package contents and include a SHA-256 checksum.
- Replace obsolete publishing scripts and publish new versions as prereleases without overwriting existing releases.

**Validation:** local JavaScript syntax and mocked behavior tests pass, including Custom handoff/cancellation and invalid-draft closing. Package contents, checksum and repeat-build identity are checked. No live Thunderbird/Betterbird UI or CalDAV delivery test was possible in the build environment. The CalDAV server must preserve and deliver EMAIL alarms; this extension does not send mail. Requires Thunderbird/Betterbird 140+ and privileged Experiment APIs.
