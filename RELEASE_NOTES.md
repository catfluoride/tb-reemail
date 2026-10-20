# tb-reemail v0.5.0 — experimental

New **Email reminder…** entry in the event editor's native Reminder dropdown for writable CalDAV calendars. Configure recipients, lead time, subject and body inline, without entering Custom.

Retains native Custom alarm functionality, including combined DISPLAY and EMAIL alarms; restores EMAIL after Thunderbird's native save filter. Existing single whole-minute pre-start EMAIL alarms map to the new shortcut when reopened.

**Important:** This build passes local simulated tests but has not been validated in a running Thunderbird/Betterbird instance or against any CalDAV server. The CalDAV server must actually send EMAIL alarms. Uses privileged Experiment APIs requiring unrestricted permissions.
