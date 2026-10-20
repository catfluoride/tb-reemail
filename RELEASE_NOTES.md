## tb-reemail v0.4.0 — experimental developer prototype

Source code and the installable Thunderbird/Betterbird XPI for CalDAV EMAIL VALARM editing.

- Adds a **Send an Email** option to Thunderbird's native reminder dialog for writable CalDAV event calendars.
- Adds recipient, subject, and message fields.
- Attempts to keep `ACTION:EMAIL` alarms when the event is saved.
- Existing display/popup alarms are retained.

**Known limitation:** This release has passed local syntax and simulated tests but has **not** been tested in a live Thunderbird/Betterbird process, nor verified against a CalDAV server. The server must support `ACTION:EMAIL` to deliver the alarm; this add-on does not send mail. Some servers may reject or strip EMAIL alarms.

**Security:** Uses privileged Thunderbird Experiment APIs; review the source before installing.
