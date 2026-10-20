/* CalDAV Email VALARM Editor 0.5.0 - GPL-3.0-only
 * MailExtension Experiment for Betterbird / Thunderbird.
 * Does not send email, alter credentials, or contact servers directly.
 * Based on the native 2026 calendar reminder dialog and editor save paths.
 */
"use strict";

const { ExtensionCommon } = ChromeUtils.importESModule("resource://gre/modules/ExtensionCommon.sys.mjs");
const { ExtensionSupport } = ChromeUtils.importESModule("resource:///modules/ExtensionSupport.sys.mjs");
const { CalAttendee } = ChromeUtils.importESModule("resource:///modules/CalAttendee.sys.mjs");
// Do not import Services.sys.mjs: the user's Betterbird build rejected that import.

const REMINDER_URL = "chrome://calendar/content/calendar-event-dialog-reminder.xhtml";
const EDITOR_URL = "chrome://calendar/content/calendar-item-iframe.xhtml";
const WINDOW_URLS = [
  REMINDER_URL,
  "chrome://calendar/content/calendar-event-dialog.xhtml",
  "chrome://messenger/content/messenger.xhtml",
];
const HTML_NS = "http://www.w3.org/1999/xhtml";
const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const QUICK_VALUE = "tb-reemail";
const QUICK_ID = "tb-reemail-shortcut";
const MAX_LEAD_MINUTES = 60 * 24 * 90;
const TAG = "[VALARM editor]";

function writableCalDAV(calendar) {
  if (!calendar) return false;
  try {
    return calendar.type === "caldav" && !calendar.readOnly && !calendar.getProperty("disabled");
  } catch (e) {
    console.error(TAG, "Failed to inspect calendar", e);
    return false;
  }
}
function splitEmails(raw) {
  return [...new Set(String(raw || "").split(/[;,\s]+/).map(x => x.trim()).filter(Boolean))];
}
function validEmail(address) {
  return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(address);
}
function emailData(alarm) {
  return {
    recipients: (alarm.getAttendees?.() || []).map(a => a.id?.replace(/^mailto:/i, "") || "").join(", "),
    subject: alarm.summary || "",
    body: alarm.description || "",
  };
}
function applyEmailFields(alarm, data, title) {
  const addresses = splitEmails(data.recipients);
  if (!addresses.length || !addresses.every(validEmail)) {
    throw new Error("Enter at least one valid recipient email address.");
  }
  if (addresses.length > 30) throw new Error("Maximum 30 recipients per email alarm.");
  alarm.action = "EMAIL";
  alarm.clearAttendees();
  for (const address of addresses) {
    const attendee = new CalAttendee();
    attendee.id = `mailto:${address}`;
    alarm.addAttendee(attendee);
  }
  alarm.summary = String(data.subject || "").trim() || `Reminder: ${title || "Calendar event"}`;
  alarm.description = String(data.body || "").trim() || `Upcoming event: ${title || "Calendar event"}`;
  if (!/BEGIN:VALARM[\s\S]*ACTION:EMAIL[\s\S]*ATTENDEE/i.test(alarm.icalString)) {
    throw new Error("EMAIL VALARM could not be serialized.");
  }
  return alarm;
}

/** Thunderbird's saveReminder() strips EMAIL when capabilities report DISPLAY.
 * Patch only the *specific editor iframe*, not the calendar provider.
 * A detached immutable clone is returned by saveItem(); modify that clone
 * before Thunderbird makes it immutable and dispatches CalDAV synchronization.
 */
/**
 * Native menu presets assume DISPLAY, so we attach a configured alarm to our
 * own menuitem. The native save routine still filters EMAIL from DISPLAY-only
 * calendars; patch saveItem to restore that one alarm on the mutable clone.
 */
function patchEditor(win, cleanup) {
  try {
    if (!win || win.document?.location?.href !== EDITOR_URL || typeof win.saveItem !== "function") return false;
    if (win.__valarm05EditorPatch) return true;
    const selector = win.document.querySelector(".item-alarm");
    if (!selector) {
      console.warn(TAG, "Editor iframe detected but .item-alarm is absent");
      return false;
    }
    const original = win.saveItem;
    const patched = function (...args) {
      const quick = win.__valarm05Quick;
      if (selector.value === QUICK_VALUE && quick && !quick.prepare(true)) {
        throw new Error("Please correct the Email reminder settings before saving.");
      }
      const item = original.apply(this, args);
      if (!writableCalDAV(item?.calendar)) return item;
      const choice = win.document.querySelector(".item-alarm");
      if (choice?.value !== "custom" && choice?.value !== QUICK_VALUE) return item;
      const alarms = choice.value === "custom"
        ? choice.querySelector(".reminder-custom-menuitem")?.reminders
        : choice.selectedItem?.reminders;
      if (!alarms) return item;
      const current = new Set(item.getAlarms().map(a => a.icalString));
      let added = 0;
      for (const alarm of alarms) {
        if (alarm?.action !== "EMAIL") continue;
        try {
          const value = alarm.icalString;
          if (!current.has(value)) {
            item.addAlarm(alarm.clone());
            current.add(value);
            added++;
          }
        } catch (err) {
          console.error(TAG, "EMAIL alarm rejected during save", err);
        }
      }
      console.info(TAG, "Editor save: restored EMAIL alarms", added,
        "total EMAIL:", item.getAlarms().filter(x => x.action === "EMAIL").length);
      return item;
    };
    win.saveItem = patched;
    win.__valarm05EditorPatch = true;
    const dispose = () => {
      if (win.saveItem === patched) win.saveItem = original;
      delete win.__valarm05EditorPatch;
    };
    cleanup.set(win, dispose);
    win.addEventListener("unload", dispose, { once: true });
    console.info(TAG, "Patched event saveItem() in", win.document.location.href);
    return true;
  } catch (e) {
    console.error(TAG, "Failed to patch editor", e);
    return false;
  }
}

/** Build one valid EMAIL alarm from the editor's quick fields. */
function createQuickAlarm(win, menuitem, data, title, calendar) {
  if (!writableCalDAV(calendar)) throw new Error("Select a writable CalDAV calendar.");
  const lead = Number(data.lead);
  if (!Number.isSafeInteger(lead) || lead < 0 || lead > MAX_LEAD_MINUTES) {
    throw new Error("Lead time must be between 0 and 129600 minutes (90 days).");
  }
  // This is Thunderbird's own preset creator, giving the correct calIDuration
  // and START/END relation. EMAIL is set after it creates a DISPLAY alarm.
  menuitem.setAttribute("unit", "minutes");
  menuitem.setAttribute("length", String(lead));
  menuitem.setAttribute("origin", "before");
  menuitem.setAttribute("relation", "START");
  if (typeof win.createReminderFromMenuitem !== "function") {
    throw new Error("Thunderbird preset alarm creator is unavailable.");
  }
  const alarm = win.createReminderFromMenuitem(menuitem, calendar);
  return applyEmailFields(alarm, data, title);
}

/** The shortcut only represents relative, whole-minute alarms before START.
 * Leave absolute, after-event, and sub-minute alarms in native Custom… .
 */
function isQuickCompatibleAlarm(alarm) {
  if (!alarm || alarm.action !== "EMAIL" || !alarm.offset) return false;
  if (typeof Ci !== "undefined" &&
      alarm.related !== Ci.calIAlarm.ALARM_RELATED_START) return false;
  const seconds = alarm.offset.inSeconds;
  if (!Number.isFinite(seconds) || seconds > 0 || seconds % 60 !== 0) return false;
  return Math.abs(seconds) <= MAX_LEAD_MINUTES * 60;
}

/** Add a first-class choice to the main event Reminder dropdown.
 * The small inline form avoids entering the Custom reminder dialog.
 */
function installQuickReminder(win, cleanup) {
  try {
    if (win.__valarm05Quick) return true;
    const doc = win.document;
    const selector = doc.querySelector(".item-alarm");
    const popup = selector?.menupopup || doc.getElementById("item-alarm-menupopup");
    const custom = selector?.querySelector(".reminder-custom-menuitem");
    if (!selector || !popup || !custom || !win.calendarItem) return false;
    if (!win.calendarItem.isEvent?.()) return false;

    const item = doc.createElementNS(XUL_NS, "menuitem");
    item.id = QUICK_ID;
    item.setAttribute("label", "Email reminder…");
    item.setAttribute("value", QUICK_VALUE);
    item.setAttribute("unit", "minutes");
    item.setAttribute("length", "15");
    item.setAttribute("origin", "before");
    item.setAttribute("relation", "START");
    item.reminders = [];
    popup.insertBefore(item, custom); // just before Custom…, leave native presets intact

    const box = doc.createElementNS(HTML_NS, "div");
    box.id = "tb-reemail-quick-fields";
    box.style.cssText = "display:none;margin:8px 0;padding:9px;border:1px solid ThreeDShadow;border-radius:4px;max-width:540px;background:Field;color:FieldText";
    const label = (title, ctrl) => {
      const wrapper = doc.createElementNS(HTML_NS, "label");
      wrapper.style.cssText = "display:block;margin-bottom:6px;font-size:inherit;";
      const caption = doc.createElementNS(HTML_NS, "span");
      caption.textContent = title;
      caption.style.cssText = "display:block;margin-bottom:2px;";
      wrapper.append(caption, ctrl);
      box.appendChild(wrapper);
      return ctrl;
    };
    const field = (placeholder = "") => {
      const input = doc.createElementNS(HTML_NS, "input");
      input.type = "text";
      input.placeholder = placeholder;
      input.style.cssText = "width:100%;min-width:180px;box-sizing:border-box;padding:4px;font:inherit;background:Field;color:FieldText;border:1px solid ThreeDShadow;";
      return input;
    };
    const recipients = label("Email recipients (comma-separated)", field("name@example.com"));
    const lead = field();
    lead.type = "number";
    lead.min = "0";
    lead.max = String(MAX_LEAD_MINUTES);
    lead.step = "1";
    lead.value = "15";
    label("Minutes before event starts", lead);
    const subject = label("Subject (optional)", field("Reminder: event title"));
    const body = label("Message (optional)", field("Upcoming event"));
    const status = doc.createElementNS(HTML_NS, "div");
    status.setAttribute("role", "alert");
    status.style.cssText = "font-size:smaller;white-space:pre-wrap;color:var(--in-content-danger-button-background,#b22);";
    box.appendChild(status);
    const note = doc.createElementNS(HTML_NS, "small");
    note.textContent = "The CalDAV server must send the email. This extension only writes VALARM.";
    box.appendChild(note);
    const anchor = doc.getElementById("event-grid-alarm-picker-box") || selector.parentNode;
    anchor.parentNode.insertBefore(box, anchor.nextSibling);

    let lastCalendar = null;
    const calendar = () => typeof win.getCurrentCalendar === "function"
      ? win.getCurrentCalendar() : win.calendarItem?.calendar;
    const read = () => ({recipients:recipients.value, lead:lead.value, subject:subject.value, body:body.value});
    function prepare(showError = false) {
      if (selector.value !== QUICK_VALUE) return true;
      try {
        item.reminders = [createQuickAlarm(win, item, read(),
          doc.getElementById("item-title")?.value || win.calendarItem?.title, calendar())];
        status.textContent = "";
        return true;
      } catch (e) {
        item.reminders = [];
        status.textContent = showError ? String(e.message || e) : "";
        if (showError) { box.style.display = "block"; recipients.focus(); }
        return false;
      }
    }
    function syncFromItem() {
      const c = calendar();
      const writable = writableCalDAV(c) && win.calendarItem?.isEvent?.();
      item.hidden = !writable;
      if (!writable) {
        box.style.display = "none";
        return;
      }
      const alarms = win.calendarItem.getAlarms();
      if (alarms.length === 1 && isQuickCompatibleAlarm(alarms[0])) {
        // Recognize a previously saved single EMAIL alarm. Thunderbird would
        // otherwise put it under Custom… because DISPLAY is its default.
        const existing = alarms[0];
        const fields = emailData(existing);
        recipients.value = fields.recipients;
        subject.value = fields.subject;
        body.value = fields.body;
        const seconds = Math.abs(existing.offset?.inSeconds ?? 900);
        lead.value = String(Math.round(seconds / 60));
        item.reminders = [existing.clone()];
        selector.selectedItem = item;
        selector.value = QUICK_VALUE;
        win.gLastAlarmSelection = selector.selectedIndex;
        console.info(TAG, "Recognized saved EMAIL reminder in main dropdown");
      }
      show();
    }
    function show() {
      const writable = writableCalDAV(calendar());
      item.hidden = !writable;
      if (!writable && selector.value === QUICK_VALUE) {
        selector.value = "none";
        item.reminders = [];
      }
      box.style.display = writable && selector.value === QUICK_VALUE ? "block" : "none";
      if (selector.value === QUICK_VALUE && writable) prepare(false);
    }
    const onCommand = () => {
      if (selector.value === QUICK_VALUE && lastCalendar !== calendar()) {
        lastCalendar = calendar();
      }
      show();
    };
    const onInput = () => prepare(false);
    selector.addEventListener("command", onCommand);
    for (const field of [recipients, lead, subject, body]) field.addEventListener("input", onInput);
    const calendarPicker = doc.getElementById("item-calendar");
    calendarPicker?.addEventListener("command", show);

    // Prevent native Save or Save & Close from proceeding with invalid data.
    // onAccept() otherwise disposes the editor even if saveItem() throws.
    const originalSaveCommand = win.onCommandSave;
    const originalAccept = win.onAccept;
    if (typeof originalSaveCommand === "function") {
      win.onCommandSave = function (...args) {
        if (!prepare(true)) return false;
        return originalSaveCommand.apply(this, args);
      };
    }
    if (typeof originalAccept === "function") {
      win.onAccept = function (...args) {
        if (!prepare(true)) return false;
        return originalAccept.apply(this, args);
      };
    }
    const quick = {prepare, show, syncFromItem};
    win.__valarm05Quick = quick;
    const dispose = () => {
      selector.removeEventListener("command", onCommand);
      for (const field of [recipients, lead, subject, body]) field.removeEventListener("input", onInput);
      calendarPicker?.removeEventListener("command", show);
      if (win.onCommandSave !== originalSaveCommand) win.onCommandSave = originalSaveCommand;
      if (win.onAccept !== originalAccept) win.onAccept = originalAccept;
      delete win.__valarm05Quick;
      box.remove();
      item.remove();
    };
    const prior = cleanup.get(win);
    cleanup.set(win, () => {dispose(); prior?.();});
    win.addEventListener("unload", dispose, {once: true});
    syncFromItem();
    console.info(TAG, "Email reminder shortcut installed in main editor dropdown");
    return true;
  } catch (e) {
    console.error(TAG, "Quick reminder integration failed", e, e?.stack);
    return false;
  }
}

function findEditors(root, cleanup) {
  if (!root) return false;
  let found = false;
  const visited = new Set();
  function traverse(win, depth) {
    if (!win || visited.has(win) || depth > 5) return;
    visited.add(win);
    try {
      if (patchEditor(win, cleanup)) {
        found = true;
        installQuickReminder(win, cleanup);
      }
      for (const frame of win.document.querySelectorAll("iframe, browser")) {
        try {
          if (frame.contentWindow) traverse(frame.contentWindow, depth + 1);
        } catch (e) { /* inaccessible content: not a calendar editor */ }
      }
    } catch (e) { /* uninspectable window */ }
  }
  traverse(root, 0);
  return found;
}
function monitorEditors(root, cleanup) {
  const scan = () => findEditors(root, cleanup);
  try {
    const observer = new root.MutationObserver(scan);
    observer.observe(root.document.documentElement, {subtree: true, childList: true});
    const onLoad = () => scan();
    root.document.addEventListener("load", onLoad, true);
    // The editor iframe may already be loaded when the parent onLoad runs.
    scan();
    const dispose = () => {
      observer.disconnect();
      root.document.removeEventListener("load", onLoad, true);
    };
    cleanup.set(root, dispose);
    root.addEventListener("unload", dispose, {once: true});
  } catch (e) {
    console.error(TAG, "Editor frame monitoring failed", e);
  }
}

function addEmailUI(win, cleanup) {
  try {
    const doc = win.document;
    if (doc.getElementById("valarm05-email-panel")) return;
    const args = win.arguments?.[0];
    if (!args || !writableCalDAV(args.calendar)) return;
    if (!args.item?.isEvent?.()) return; // event creation/editing, not tasks
    const actionNode = doc.getElementById("reminder-action-EMAIL");
    const actionMenu = doc.getElementById("reminder-actions-menulist");
    const list = doc.getElementById("reminder-listbox");
    const dialog = doc.querySelector("dialog");
    if (!actionNode || !actionMenu || !list || !dialog) {
      console.error(TAG, "Native reminder controls not found");
      return;
    }
    // The hook runs after the native onLoad filtered actions. Override that
    // dialog-local filter and show the built-in EMAIL menuitem.
    win.allowedActionsMap.EMAIL = true;
    actionNode.hidden = false;
    actionNode.removeAttribute("hidden");
    console.info(TAG, "EMAIL action enabled in native reminder dialog");

    // Restore existing EMAIL alarms that native loadReminders() skipped.
    const existing = args.reminders || args.item.getAlarms();
    const already = new Set([...list.children].map(x => x.reminder?.icalString));
    for (const alarm of existing) {
      if (alarm.action !== "EMAIL" || already.has(alarm.icalString)) continue;
      const row = win.setupListItem(null, alarm.clone(), args.item);
      if (row) {
        list.appendChild(row);
        already.add(alarm.icalString);
      }
    }

    const panel = doc.createElementNS(HTML_NS, "div");
    panel.id = "valarm05-email-panel";
    panel.style.cssText = "border:1px solid ThreeDShadow; margin:7px 6px 4px; padding:9px; border-radius:4px; background:Field; color:FieldText; min-width:300px; box-sizing:border-box";
    const heading = doc.createElementNS(HTML_NS, "strong");
    heading.textContent = "Email alarm (CalDAV)";
    panel.appendChild(heading);
    function field(label, multiline = false) {
      const wrapper = doc.createElementNS(HTML_NS, "label");
      wrapper.style.cssText = "display:block;margin-top:7px;";
      const caption = doc.createElementNS(HTML_NS, "span");
      caption.textContent = label;
      caption.style.cssText = "display:block;margin-bottom:3px;";
      wrapper.appendChild(caption);
      const input = doc.createElementNS(HTML_NS, multiline ? "textarea" : "input");
      if (!multiline) input.type = "text";
      if (multiline) input.rows = 2;
      input.style.cssText = "width:100%;min-height:24px;box-sizing:border-box;padding:4px;font:inherit;border:1px solid ThreeDShadow;background:Field;color:FieldText";
      wrapper.appendChild(input);
      panel.appendChild(wrapper);
      return input;
    }
    const recipients = field("Recipients (email addresses, separated by commas)");
    recipients.placeholder = "name@example.com";
    const subject = field("Subject (optional)");
    const body = field("Message (optional)", true);
    const note = doc.createElementNS(HTML_NS, "small");
    note.textContent = "The CalDAV server must deliver these emails. Thunderbird does not send them.";
    note.style.cssText = "display:block;margin-top:8px;opacity:.8";
    panel.appendChild(note);
    const error = doc.createElementNS(HTML_NS, "div");
    error.setAttribute("role", "alert");
    error.style.cssText = "margin-top:4px;color:#b22;white-space:pre-wrap";
    panel.appendChild(error);
    dialog.appendChild(panel);
    const drafts = new WeakMap();
    const read = () => ({recipients: recipients.value, subject: subject.value, body: body.value});
    let active = null;
    let isChanging = false;
    let expanded = false;
    function stash() {
      if (!isChanging && active && active.action === "EMAIL") drafts.set(active, read());
    }
    function show() {
      stash();
      const alarm = list.selectedItem?.reminder;
      active = alarm?.action === "EMAIL" ? alarm : null;
      panel.hidden = !active;
      panel.style.display = active ? "block" : "none";
      if (!active) return;
      if (!expanded) {
        expanded = true;
        win.setTimeout(() => { try { win.sizeToContent(); } catch (e) {} }, 0);
      }
      const d = drafts.get(active) || emailData(active);
      isChanging = true;
      recipients.value = d.recipients;
      subject.value = d.subject;
      body.value = d.body;
      error.textContent = "";
      isChanging = false;
    }
    for (const input of [recipients, subject, body]) input.addEventListener("input", stash);
    const later = () => win.setTimeout(show, 0);
    list.addEventListener("select", later);
    actionMenu.addEventListener("command", later);
    doc.getElementById("reminder-new-button")?.addEventListener("command", later);
    doc.getElementById("reminder-remove-button")?.addEventListener("command", later);
    const validate = event => {
      stash();
      for (const row of list.children) {
        const alarm = row.reminder;
        if (alarm?.action !== "EMAIL") continue;
        const details = drafts.get(alarm) || emailData(alarm);
        try {
          applyEmailFields(alarm, details, args.item.title);
        } catch (e) {
          list.selectItem(row);
          show();
          error.textContent = String(e.message || e);
          event.preventDefault();
          event.stopImmediatePropagation();
          recipients.focus();
          return;
        }
      }
      console.info(TAG, "Validated EMAIL alarm(s):", [...list.children].filter(x => x.reminder?.action === "EMAIL").length);
    };
    doc.addEventListener("dialogaccept", validate, true);

    // The Save & Close action is handled by the editor iframe, not by this dialog.
    // Patch the opener now too; this works even if parent frame monitoring missed it.
    const patched = findEditors(win.opener, cleanup) || findEditors(win.opener?.opener, cleanup);
    console.info(TAG, "Editor save hook available:", patched);
    if (!patched) {
      const warning = doc.createElementNS(HTML_NS, "div");
      warning.style.cssText = "color:#b22;margin-top:6px";
      warning.textContent = "Warning: event save hook not detected; EMAIL alarms may be discarded.";
      panel.appendChild(warning);
    }
    const dispose = () => {
      doc.removeEventListener("dialogaccept", validate, true);
      list.removeEventListener("select", later);
      actionMenu.removeEventListener("command", later);
      panel.remove();
    };
    cleanup.set(win, dispose);
    win.addEventListener("unload", dispose, {once: true});
    // Native selection is deferred on its own load; likewise defer ours.
    win.setTimeout(show, 0);
    console.info(TAG, "Email reminder fields installed");
  } catch (e) {
    console.error(TAG, "Failed to install EMAIL reminder controls", e, e?.stack);
  }
}

var valarmEditor = class extends ExtensionCommon.ExtensionAPI {
  constructor(extension) {
    super(extension);
    this._listenerID = null;
    this._disposers = new Map();
  }
  getAPI(context) {
    return {valarmEditor: {install: async () => {
      if (this._listenerID) return true;
      const id = context.extension.id;
      const registered = ExtensionSupport.registerWindowListener(id, {
        chromeURLs: WINDOW_URLS,
        onLoadWindow: win => {
          try {
            if (win.document.location.href === REMINDER_URL) addEmailUI(win, this._disposers);
            else monitorEditors(win, this._disposers);
          } catch (e) { console.error(TAG, "Window callback failure", e); }
        },
      });
      if (!registered) throw new Error("Window listener registration returned false");
      this._listenerID = id;
      console.info(TAG, "Listening for editor + reminder windows", WINDOW_URLS);
      return true;
    }}};
  }
  onShutdown(isAppShutdown) {
    for (const dispose of this._disposers.values()) {
      try { dispose(); } catch (e) { console.warn(TAG, "Cleanup failed", e); }
    }
    this._disposers.clear();
    if (this._listenerID) {
      ExtensionSupport.unregisterWindowListener(this._listenerID);
      this._listenerID = null;
    }
    if (!isAppShutdown) {
      try {
        if (typeof Services !== "undefined") Services.obs.notifyObservers(null, "startupcache-invalidate");
      } catch (e) { console.warn(TAG, "Could not invalidate startup cache", e); }
    }
  }
};
