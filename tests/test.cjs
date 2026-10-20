'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '../api/implementation.js'), 'utf8');
class CalAttendee {
  constructor() { this.id = ''; }
}
class ExtensionAPI { constructor() {} }
const listeners = new Map();
const context = {
  ChromeUtils: {
    importESModule(spec) {
      if (spec.includes('ExtensionCommon')) return {ExtensionCommon: {ExtensionAPI}};
      if (spec.includes('ExtensionSupport')) return {ExtensionSupport: {registerWindowListener(id, obj) {listeners.set(id, obj); return true;}, unregisterWindowListener(id) {listeners.delete(id);}}};
      if (spec.includes('CalAttendee')) return {CalAttendee};
      throw new Error('Unexpected import: ' + spec);
    }
  },
  console: {info() {}, warn() {}, error(...args) {throw new Error('ERROR: ' + args.map(String).join(' '));}}
};
vm.runInNewContext(script + '\nglobalThis.TEST={writableCalDAV, splitEmails, validEmail, applyEmailFields, patchEditor, findEditors, valarmEditor};', context);
const api = context.TEST;
function alarm(action, attendees = []) {
  return {
    action,
    summary: 'Original summary',
    description: 'Original body',
    guests: attendees,
    getAttendees() { return this.guests; },
    clearAttendees() { this.guests = []; },
    addAttendee(a) { this.guests.push(a); },
    get icalString() {
      return `BEGIN:VALARM\nACTION:${this.action}\nTRIGGER:-PT15M\nSUMMARY:${this.summary}\nDESCRIPTION:${this.description}\n${this.guests.map(a => `ATTENDEE:${a.id}`).join('\n')}\nEND:VALARM`;
    },
    clone() {
      const copy = alarm(this.action, this.guests.map(a => ({id: a.id})));
      copy.summary = this.summary;
      copy.description = this.description;
      return copy;
    }
  };
}
function calendar(type='caldav', readOnly=false) {
  return {type, readOnly, getProperty(key) { return key === 'disabled' ? false : null; }};
}
function createEditor(c, value='custom', configured=[]) {
  const selector = {value, querySelector(key) {return key === '.reminder-custom-menuitem' ? {reminders: configured} : null;}};
  const item = {
    calendar: c, alarms: [alarm('DISPLAY')],
    getAlarms() {return this.alarms;},
    addAlarm(a) {this.alarms.push(a);}
  };
  const win = {
    document: {location: {href: 'chrome://calendar/content/calendar-item-iframe.xhtml'}, querySelector(key) {return key === '.item-alarm' ? selector : null;}, querySelectorAll() {return []; }},
    saveItem() {return item;}, addEventListener() {}
  };
  return {win, item, selector};
}
assert.deepEqual(Array.from(api.splitEmails('a@x.com, b@y.org; a@x.com')), ['a@x.com', 'b@y.org']);
assert.equal(api.validEmail('x@example.org'), true);
assert.equal(api.validEmail('in valid@example.org'), false);
assert.equal(api.writableCalDAV(calendar()), true);
assert.equal(api.writableCalDAV(calendar('storage')), false);
assert.equal(api.writableCalDAV(calendar('caldav', true)), false);
assert.equal(api.writableCalDAV({type:'caldav',readOnly:false,getProperty(){return true;}}), false);
const email = alarm('DISPLAY');
api.applyEmailFields(email, {recipients:'a@example.net,b@example.org',subject:'',body:''}, 'Test event');
assert.equal(email.action, 'EMAIL');
assert.equal(email.guests.length, 2);
assert.equal(email.summary, 'Reminder: Test event');
assert.match(email.icalString, /ATTENDEE:mailto:a@example.net/);
assert.throws(() => api.applyEmailFields(alarm('DISPLAY'), {recipients:'garbage',subject:'',body:''}, 'x'), /valid recipient/);
for (const c of [calendar('storage'), calendar('caldav', true)]) {
  const {win,item} = createEditor(c, 'custom', [email]);
  assert.equal(api.patchEditor(win, new Map()), true);
  assert.equal(win.saveItem().getAlarms().length, 1);
}
const {win, item, selector} = createEditor(calendar(), 'custom', [email]);
const cleanup = new Map();
assert.equal(api.patchEditor(win, cleanup), true);
assert.equal(api.patchEditor(win, cleanup), true);
assert.equal(win.saveItem().getAlarms().length, 2);
assert.equal(win.saveItem().getAlarms().length, 2, 'same EMAIL alarm is not duplicated');
selector.value = 'none';
item.alarms = [alarm('DISPLAY')];
assert.equal(win.saveItem().getAlarms().length, 1, 'no email restoration after user changes reminder to none');
cleanup.get(win)();
assert.equal(win.__valarm05EditorPatch, undefined);
// Extension registration is compatible with v0.3.1's verified API pattern.
const ext = new api.valarmEditor();
const result = ext.getAPI({extension:{id:'test@local'}}).valarmEditor.install();
result.then(() => {
  assert.equal(listeners.size, 1);
  ext.onShutdown(false);
  assert.equal(listeners.size, 0);
  console.log('PASS: 17 checks (address validation, CalDAV restriction, RFC fields, save restoration, removal, listener lifecycle)');
}).catch(err => { console.error(err); process.exitCode = 1; });
