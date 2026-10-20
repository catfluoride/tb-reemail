'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const code = fs.readFileSync(path.join(__dirname, '../api/implementation.js'),'utf8');
class Attendee { constructor() { this.id=''; } }
class API { constructor() {} }
const sandbox={
  ChromeUtils:{importESModule(p){
    if(p.includes('ExtensionCommon'))return{ExtensionCommon:{ExtensionAPI:API}};
    if(p.includes('ExtensionSupport'))return{ExtensionSupport:{registerWindowListener(){return true},unregisterWindowListener(){}}};
    if(p.includes('CalAttendee'))return{CalAttendee:Attendee};
    throw Error(p);
  }},
  Ci:{calIAlarm:{ALARM_RELATED_START:1,ALARM_RELATED_END:2}},
  console:{info(){},warn(){},error(...args){throw Error(args.map(String).join(' '));}}
};
vm.runInNewContext(code+'\nglobalThis.API={createQuickAlarm,isQuickCompatibleAlarm,installQuickReminder,patchEditor};',sandbox);
const {API:helper}=sandbox;
function mkAlarm(action='DISPLAY'){
  return {
    action,related:1,offset:{inSeconds:-900},guests:[],summary:'',description:'',
    getAttendees(){return this.guests},clearAttendees(){this.guests=[]},addAttendee(a){this.guests.push(a)},
    get icalString(){return ['BEGIN:VALARM','ACTION:'+this.action,'TRIGGER:-PT15M','SUMMARY:'+this.summary,'DESCRIPTION:'+this.description,...this.guests.map(a=>'ATTENDEE:'+a.id),'END:VALARM'].join('\n')},
    clone(){const a=mkAlarm(this.action);a.related=this.related;a.offset={...this.offset};a.guests=this.guests.map(x=>({id:x.id}));a.summary=this.summary;a.description=this.description;return a;}
  }
}
function mockCal(){return {type:'caldav',readOnly:false,getProperty(k){return k==='disabled'?false:null}};}
class El {
  constructor(tag){this.localName=tag;this.style={};this.nodes=[];this.attrs={};this.handlers={};this.parentNode=null;this.value='';this.reminders=[];}
  setAttribute(k,v){this.attrs[k]=String(v)}
  getAttribute(k){return this.attrs[k]??null}
  hasAttribute(k){return k in this.attrs}
  appendChild(c){c.parentNode=this;this.nodes.push(c);return c}
  append(...children){children.forEach(c=>this.appendChild(c))}
  insertBefore(c,b){c.parentNode=this;let i=this.nodes.indexOf(b);this.nodes.splice(i<0?this.nodes.length:i,0,c);return c}
  remove(){const i=this.parentNode?.nodes.indexOf(this)??-1;if(i>=0)this.parentNode.nodes.splice(i,1)}
  get children(){return this.nodes}
  addEventListener(k,fn){(this.handlers[k]??=[]).push(fn)}
  removeEventListener(k,fn){this.handlers[k]=(this.handlers[k]||[]).filter(x=>x!==fn)}
  emit(k){for(const fn of this.handlers[k]||[])fn()}
  focus(){this.focused=true}
}
function scenario(existing=[]){
  const cal=mockCal(), selector=new El('menulist'),popup=new El('menupopup');
  const custom=new El('menuitem');custom.value='custom';custom.reminders=[];
  const none=new El('menuitem');none.value='none';popup.appendChild(none);popup.appendChild(custom);
  selector.menupopup=popup;selector.appendChild(popup);selector.value='none';
  selector.querySelector=k=>k==='.reminder-custom-menuitem'?custom:null;
  const root=new El('td'), anchor=new El('hbox');root.appendChild(anchor);anchor.appendChild(selector);
  const title={value:'Meeting'};
  const doc={location:{href:'chrome://calendar/content/calendar-item-iframe.xhtml'},querySelector:q=>q==='.item-alarm'?selector:null,
    querySelectorAll(){return[]},
    getElementById:id=>({'item-alarm-menupopup':popup,'event-grid-alarm-picker-box':anchor,'item-title':title})[id]||null,
    createElementNS:(ns,tag)=>new El(tag)};
  const item={calendar:cal,alarms:existing,getAlarms(){return this.alarms},addAlarm(a){this.alarms.push(a)}};
  const old={calendar:cal, getAlarms(){return existing},isEvent(){return true},title:'Meeting'};
  let saves=0, accepts=0;
  const win={document:doc,calendarItem:old,getCurrentCalendar(){return cal},
    createReminderFromMenuitem(node){const a=mkAlarm();a.offset.inSeconds=-60*Number(node.getAttribute('length'));return a;},
    onCommandSave(){saves++},onAccept(){accepts++},
    saveItem(){item.alarms=[];return item},addEventListener(){},gLastAlarmSelection:0};
  Object.defineProperty(selector,'selectedItem',{get(){return this.selected},set(v){this.selected=v;this.value=v?.value||v?.getAttribute('value')||''}});
  Object.defineProperty(selector,'selectedIndex',{get(){return popup.children.indexOf(this.selected)},set(v){this.selected=popup.children[v];this.value=this.selected?.value||''}});
  const cleanup=new Map();
  assert.equal(helper.patchEditor(win,cleanup),true);
  assert.equal(helper.installQuickReminder(win,cleanup),true);
  assert.equal(helper.installQuickReminder(win,cleanup),true,'idempotent');
  return {win,cal,item,selector,popup,anchor,saves:()=>saves,accepts:()=>accepts,cleanup};
}
// New event: choose quick action directly in native Reminder dropdown.
{
  const t=scenario();
  const option=t.popup.children.find(x=>x.id==='tb-reemail-shortcut');
  assert.ok(option,'Email reminder inserted');
  assert.equal(option.getAttribute('value'),'tb-reemail');
  t.selector.selectedItem=option;t.selector.emit('command');
  const panel=t.anchor.parentNode.children.find(x=>x.id==='tb-reemail-quick-fields');
  assert.equal(panel.style.display,'block');
  const inputs=panel.children.filter(x=>x.localName==='label').map(x=>x.children[1]);
  const [recipient,lead,subject,body]=inputs;
  assert.equal(t.win.onCommandSave(),false,'invalid form blocks saving');
  assert.equal(t.saves(),0);
  recipient.value='someone@example.com';lead.value='45';subject.value='Note';body.value='Body';
  for(const c of inputs)c.emit('input');
  t.win.onCommandSave();assert.equal(t.saves(),1);
  assert.equal(t.win.saveItem().getAlarms().length,1);
  const a=t.item.getAlarms()[0];
  assert.equal(a.action,'EMAIL');assert.equal(a.offset.inSeconds,-2700);
  assert.match(a.icalString,/ATTENDEE:mailto:someone@example.com/);
  assert.equal(a.summary,'Note');assert.equal(a.description,'Body');
  t.win.saveItem();assert.equal(t.item.getAlarms().length,1,'no duplicate alarms on repeated saves');
  t.selector.selectedItem=t.popup.children[0];t.selector.emit('command');
  assert.equal(panel.style.display,'none');
  assert.ok(t.win.saveItem());
}
// Reopened event: restore shortcut selection only for supported email alarms.
{
  const a=mkAlarm('EMAIL');a.offset={inSeconds:-1800};a.guests=[{id:'mailto:existing@example.org'}];
  const t=scenario([a]);assert.equal(t.selector.value,'tb-reemail');
  assert.equal(t.win.saveItem().getAlarms().length,1);
  const incompatible=a.clone();incompatible.offset={inSeconds:1800};
  const u=scenario([incompatible]);assert.equal(u.selector.value,'none','do not remap unsupported alarm');
  assert.equal(helper.isQuickCompatibleAlarm(incompatible),false);
  const multi=scenario([a,mkAlarm('DISPLAY')]);
  assert.equal(multi.selector.value,'none','multi alarm stays in native Custom');
}
assert.throws(()=>helper.createQuickAlarm({createReminderFromMenuitem:()=>mkAlarm()},new El('menuitem'),{recipients:'test@example.org',lead:'129601'},'x',mockCal()),/Lead time/);
console.log('PASS: quick-menu insertion, visible editor form, validation, save, no duplication, reopened alarm, nonconvertible alarms');
