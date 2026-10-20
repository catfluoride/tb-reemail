# tb-reemail

**Thunderbird / Betterbird CalDAV email reminders.** Version **0.5.0** (experimental; Thunderbird 140+).

This MailExtension Experiment exposes the native iCalendar `VALARM` action `EMAIL` for writable CalDAV event calendars. It creates RFC 5545 email alarms in the event; **your CalDAV server must deliver the emails**. It does not send mail directly.

## What's new in v0.5.0

The event editor's **Reminder** dropdown now includes **Email reminder…**. You can configure a single email reminder directly in the editor without navigating through **Custom…**.

The inline controls let you set:

- One or more recipients, separated by commas.
- Minutes before the event starts (default 15, maximum 90 days).
- Optional subject and message. Blank values use defaults based on the event title.

The existing **Custom…** dialog is still available for combining popup and email alarms, unusual trigger times, and multiple alarms. An existing single EMAIL alarm with a relative whole-minute trigger before event start is recognized as **Email reminder…** when you reopen an event; other alarms remain under Custom.

## Installation

1. Download `tb-reemail-0.5.0.xpi`.
2. Thunderbird/Betterbird → **Add-ons and Themes** (`Ctrl+Shift+A`) → gear → **Install Add-on From File…**.
3. Choose the XPI, review the unrestricted-access permission and restart Thunderbird/Betterbird.
4. Disable or replace v0.4.0; this package uses the same extension ID, so Thunderbird should treat it as an update.

The extension needs privileged Thunderbird internals; its unrestricted-access permission is inherent to a MailExtension Experiment. Review the source before installing.

## Usage (quick email reminder)

1. Create an event in a **writable native CalDAV** calendar.
2. In the standard **Reminder** dropdown, select **Email reminder…**.
3. Enter recipient addresses and optionally change the number of minutes, subject, and message.
4. Save the event. Invalid recipient addresses or out-of-range lead times block the editor's Save and Save & Close commands.
5. Reopen the event to check the setting. If possible, inspect the server's `.ics` representation to verify that it contains `BEGIN:VALARM`, `ACTION:EMAIL`, `SUMMARY`, `DESCRIPTION`, and one or more `ATTENDEE:mailto:` entries.

Normal DISPLAY reminders remain available. If you need **both** a popup and an email alarm, use **Reminder → Custom…** and add a second alarm in the native reminder dialog.

## What it does not do

- It cannot make CalDAV servers send email alarms if they do not support `ACTION:EMAIL`.
- It does not send messages through Thunderbird, SMTP, or any third-party service.
- It does not guarantee that a CalDAV server will preserve the alarm after synchronization.
- It cannot guarantee compatibility with all Thunderbird / Betterbird versions, as private editor APIs can change.

## Troubleshooting

- **No Email reminder option**: confirm writable `caldav` calendar, extension enabled, and restart. Check the Error Console (`Ctrl+Shift+J`) for `[VALARM editor]`.
- **Email option appears but doesn't survive Save**: check the Error Console for `[VALARM editor] Editor save...`; capture event `.ics` before and after server sync.
- **Alarm is stored but no email arrives**: the CalDAV server must implement email alarms and actually deliver the message.
- **Only Custom appears when reopening an event**: triggers other than whole minutes before event start, absolute alarms, and multiple simultaneous alarms intentionally remain under Custom.

## Development and testing

The project is **entirely vibe coded**. [ChatGPT (OpenAI)](https://chatgpt.com/) contributed code, tests, packaging and documentation, guided by [@catfluoride](https://github.com/catfluoride), who specified requirements and tested earlier builds. It is experimental and not independently audited. **If you don't like it, you can just ignore it.**

Source tests:

```bash
node --check background.js
node --check api/implementation.js
node tests/test.cjs
node tests/quick.cjs
```

Package from the project root:

```bash
zip -r tb-reemail-0.5.0.xpi manifest.json background.js api/ README.md LICENSE
```

**Test status**: syntax checks and mocked behavior tests pass. This exact version has *not* been tested in a live Thunderbird/Betterbird or against a CalDAV server. Test on disposable events before using it for important reminders.

## License

GNU General Public License v3.0 only (`GPL-3.0-only`). See [LICENSE](LICENSE).

## Sources

- [Thunderbird event editor](https://searchfox.org/comm-central/source/calendar/base/content/item-editing/calendar-item-iframe.xhtml)
- [Thunderbird reminder functions](https://searchfox.org/comm-central/source/calendar/base/content/dialogs/calendar-dialog-utils.js)
- [RFC 5545 section 3.6.6, VALARM](https://www.rfc-editor.org/rfc/rfc5545#section-3.6.6)
