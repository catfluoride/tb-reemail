# tb-reemail

**CalDAV EMAIL VALARM editor for Thunderbird / Betterbird 140+.**

Version **0.4.0** — **experimental; not yet verified in a live Betterbird/Thunderbird instance or against a CalDAV server.**

The source and XPI are the previously built v0.4.0 developer prototype. This repository package only adds publication materials (license, checksum, release notes, and publishing script); it does not change the extension's executable files.

## What it does

Adds an **email reminder** action to the existing Thunderbird/Betterbird calendar event editor for writable CalDAV calendars. Standard popup alarms remain available. A newly created `ACTION:EMAIL` reminder contains a trigger, one or more recipient `ATTENDEE` addresses, a `SUMMARY`, and a `DESCRIPTION` in the event’s iCalendar `VALARM`. The CalDAV server, not the extension, must send any emails.

## Install

Download `caldav-email-valarm-0.4.0.xpi` from the GitHub v0.4.0 release, or use the copy at [`dist/caldav-email-valarm-0.4.0.xpi`](dist/caldav-email-valarm-0.4.0.xpi). In Thunderbird/Betterbird, open Add-ons and Themes → gear → Install Add-on From File.

The extension uses a privileged MailExtension Experiment and needs unrestricted Thunderbird access. Review the source before installing.

## Usage

1. Create a test event in a **writable CalDAV** calendar.
2. Open **Reminder → Custom**.
3. Click **Add** if you want to keep the existing popup reminder. Under **Choose a Reminder Action**, select **Send an Email**. Enter one or more recipient addresses separated by commas, and optionally edit the subject and message.
4. Save the reminder and event.
5. Inspect the Error Console (`Ctrl+Shift+J`) for `[VALARM editor]` logs. Reopen the event to check that the email reminder is retained. If your server allows access to the event’s `.ics`, verify that its `VALARM` contains `ACTION:EMAIL` and `ATTENDEE:mailto:...`.

The CalDAV server **must** support and send email alarms. Thunderbird does **not** send the reminder emails. Even if Betterbird accepts the alarm, the CalDAV server may reject or discard it. Test with disposable events.

## Implementation

- Privileged window hook shows the native `EMAIL` alarm action and adds recipient, subject, and message fields.
- Editor hook attempts to restore RFC 5545 `ACTION:EMAIL` alarms after Thunderbird's normal capability filtering.
- Normal `DISPLAY` alarms remain available.
- Restricted to writable CalDAV calendars (the provider must identify itself as `caldav`).
- Editing and persistence across a real CalDAV server are **not** yet validated.

## Troubleshooting

- **No “Send an Email” action:** make sure the calendar is writable, is a native CalDAV calendar, and the extension is enabled. Restart Thunderbird/Betterbird and check the Error Console for `[VALARM editor]`.
- **Email action appears but disappears after saving:** look for `Editor save hook available: false` or related errors. This version uses privileged internal editor functions that may differ across versions.
- **Alarm persists but no email arrives:** check whether your CalDAV server supports server-side `EMAIL` alarms. Thunderbird does not deliver them.
- **Permission prompt:** this uses a privileged MailExtension Experiment; it requests unrestricted Thunderbird access.

## Test / build

JavaScript syntax checks:

```sh
node --check background.js
node --check api/implementation.js
node tests/test.cjs
```

The bundled `dist/caldav-email-valarm-0.4.0.xpi` is the unchanged, previously packaged developer XPI. See `dist/*.sha256` for its checksum. The original XPI contains `manifest.json`, `background.js`, `api/`, and the original README; it does not contain the extra GitHub publishing materials.

To create a new XPI from this source for future versions:

```sh
zip -r new-build.xpi manifest.json background.js api/ README.md
```

## Development and credits

This extension is **entirely vibe coded**. [ChatGPT (OpenAI)](https://chatgpt.com/) contributed the extension code, debugging iterations, tests, packaging, and documentation, guided by [@catfluoride](https://github.com/catfluoride), who supplied the requirements and tested the prototypes.

It is an experimental, AI-generated project, not a professionally audited or guaranteed solution. **If you don't like it, you can just ignore it.**

## License

GNU General Public License, version 3 only (`GPL-3.0-only`) — see [LICENSE](LICENSE).

## References

- [Thunderbird MailExtension Experiments](https://developer.thunderbird.net/add-ons/mailextensions/experiments)
- [Calendar reminder implementation](https://searchfox.org/comm-central/source/calendar/base/content/dialogs/calendar-event-dialog-reminder.js)
- [RFC 5545 VALARM](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.6.6)

## Publishing

The repository includes `.github/workflows/release.yml`. After its binary and checksum files are committed to `main`, the workflow checks the checksum and attempts to publish them as a prerelease at `v0.4.0`. It needs GitHub Actions to be enabled and the workflow `GITHUB_TOKEN` to have `contents: write` permission. You can also use `scripts/publish.sh` with an authenticated GitHub CLI to create the public repository, tag and release together.
