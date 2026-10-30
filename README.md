# tb-reemail

**Thunderbird / Betterbird CalDAV email reminders.** Official stable release: **0.5.1** (Thunderbird 140+).

The stable release retains the original v0.5.1 tag, XPI and SHA-256 checksum. Its bundled README records the original prerelease status; current release status is shown on [GitHub Releases](https://github.com/catfluoride/tb-reemail/releases/tag/v0.5.1). The live Thunderbird/Betterbird and CalDAV testing limitations below still apply.

This MailExtension Experiment exposes the native iCalendar `VALARM` action `EMAIL` for writable CalDAV event calendars. It creates RFC 5545 email alarms in the event; **your CalDAV server must deliver the emails**. It does not send mail directly.

## What's new in v0.5.1

- Switching from **Email reminder…** to **Custom…** carries your current recipients, lead time, subject and message into the dialog. Add a popup alarm there without losing the email reminder.
- Blank lead times are rejected; explicit **0** means at event start. Invalid drafts block Save, including Save from the close prompt, while Discard and Cancel remain available.
- The EMAIL shortcut no longer participates in Thunderbird's native DISPLAY preset matching.
- A tested, reproducible build produces the XPI and checksum directly from current source. Publishing uses the manifest version and never overwrites an existing release.

## Reminder workflow

The event editor's **Reminder** dropdown now includes **Email reminder…**. You can configure a single email reminder directly in the editor without navigating through **Custom…**.

The inline controls let you set:

- One or more recipients, separated by commas.
- Minutes before the event starts (default 15, maximum 90 days).
- Optional subject and message. Blank values use defaults based on the event title.

The existing **Custom…** dialog is still available for combining popup and email alarms, unusual trigger times, and multiple alarms. An existing single EMAIL alarm with a relative whole-minute trigger before event start is recognized as **Email reminder…** when you reopen an event; other alarms remain under Custom.

## Installation

1. Download `tb-reemail-0.5.1.xpi` from [GitHub Releases](https://github.com/catfluoride/tb-reemail/releases/tag/v0.5.1), along with its `.sha256` file if you want to verify the download.
2. Thunderbird/Betterbird → **Add-ons and Themes** (`Ctrl+Shift+A`) → gear → **Install Add-on From File…**.
3. Choose the XPI, review the unrestricted-access permission and restart Thunderbird/Betterbird.
4. This package uses the same extension ID as earlier releases, so Thunderbird should treat it as an update.

The extension needs privileged Thunderbird internals; its unrestricted-access permission is inherent to a MailExtension Experiment. Review the source before installing.

## Usage (quick email reminder)

1. Create an event in a **writable native CalDAV** calendar.
2. In the standard **Reminder** dropdown, select **Email reminder…**.
3. Enter recipient addresses and optionally change the number of minutes, subject, and message.
4. Save the event. Invalid recipient addresses or out-of-range lead times block the editor's Save and Save & Close commands.
5. Reopen the event to check the setting. If possible, inspect the server's `.ics` representation to verify that it contains `BEGIN:VALARM`, `ACTION:EMAIL`, `SUMMARY`, `DESCRIPTION`, and one or more `ATTENDEE:mailto:` entries.

Normal DISPLAY reminders remain available. If you need **both** a popup and an email alarm, configure the inline email reminder, then choose **Reminder → Custom…** and add a second alarm in the native reminder dialog. Your email settings are transferred before Custom opens; cancelling Custom returns to the inline reminder. Choosing **None** removes reminders when you save.

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

The project is **entirely vibe coded**. [ChatGPT (OpenAI)](https://chatgpt.com/) contributed code, tests, packaging and documentation, guided by [@catfluoride](https://github.com/catfluoride), who specified requirements and tested earlier builds. It is not independently audited. **If you don't like it, you can just ignore it.**

Source tests:

```bash
node --check background.js
node --check api/implementation.js
node tests/test.cjs
node tests/quick.cjs
```

Build from the project root (Python 3 and Node.js required; no dependencies to install). This runs the tests, packages only the extension files plus README/license, verifies ZIP integrity and source equality, and writes a SHA-256 checksum:

```bash
python3 scripts/build.py
cd dist
sha256sum -c tb-reemail-0.5.1.xpi.sha256
```

The output is `dist/tb-reemail-0.5.1.xpi` and its `.sha256` file. Builds use a fixed file list, order, timestamps and permissions; repeated builds on the same toolchain are byte-identical. GitHub Actions verifies this, builds on pull requests, and creates an experimental prerelease for a new manifest version pushed to `main`. Existing releases are left unchanged. For an authenticated maintainer publishing a clean commit already on GitHub, `bash scripts/publish.sh` performs the same tests/build and creates the prerelease. The root `publish.sh` delegates to it.

For the published v0.5.1 package, build the original tag (`git switch --detach v0.5.1`); the updated release documentation on `main` changes the README bundled by a new build. The dedicated **Promote v0.5.1 to stable** workflow verifies that tag's commit, tests, reproducibility and byte-for-byte identity with the published assets before marking the release stable and latest. It preserves the tag and assets. Future versions continue to default to prereleases.

**Test status (v0.5.1)**: syntax checks and mocked behavior tests pass, including quick creation/reopening, Custom handoff/cancellation, invalid Save/Save & Close/close-prompt behavior, alarm removal, duplicate prevention, CalDAV restrictions and cleanup. Package contents, checksum and repeat-build identity are verified. Hooks were checked against the [Thunderbird ESR 140 editor](https://github.com/thunderbird/thunderbird-desktop/blob/esr140/calendar/base/content/item-editing/calendar-item-iframe.js) and [reminder functions](https://github.com/thunderbird/thunderbird-desktop/blob/esr140/calendar/base/content/dialogs/calendar-dialog-utils.js). This exact version has *not* been tested in a live Thunderbird/Betterbird or against a CalDAV server.

Before relying on it, use disposable events to check: create and reopen a quick EMAIL alarm; move it to Custom and add DISPLAY; cancel Custom; try invalid recipients/blank lead time; save then synchronize and reopen; choose None and confirm removal. Inspect the server's `.ics` after synchronization and confirm actual email delivery. A successful local build cannot verify server delivery.

## License

GNU General Public License v3.0 only (`GPL-3.0-only`). See [LICENSE](LICENSE).

## Sources

- [Thunderbird event editor](https://searchfox.org/comm-central/source/calendar/base/content/item-editing/calendar-item-iframe.xhtml)
- [Thunderbird reminder functions](https://searchfox.org/comm-central/source/calendar/base/content/dialogs/calendar-dialog-utils.js)
- [RFC 5545 section 3.6.6, VALARM](https://www.rfc-editor.org/rfc/rfc5545#section-3.6.6)
