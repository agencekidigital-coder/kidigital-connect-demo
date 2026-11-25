const {test}=require('node:test');
const assert=require('node:assert/strict');
const {calendarDates,upcomingRows,rowsOnDate}=require('../assets/pro-workshops.js');
test('calendar matches Monday-first month/week/day, including month boundaries',()=>{
  const month=calendarDates('2026-12-15','month');
  assert.equal(month.length,42);assert.equal(month[0],'2026-11-30');assert.equal(month.at(-1),'2027-01-10');
  assert.deepEqual(calendarDates('2026-12-15','week'),['2026-12-14','2026-12-15','2026-12-16','2026-12-17','2026-12-18','2026-12-19','2026-12-20']);
  assert.deepEqual(calendarDates('2026-12-15','day'),['2026-12-15']);
  assert.deepEqual(calendarDates('invalid','day'),[]);
});
const rows=[{id:'b',status:'draft',starts_at:'2026-12-15T14:00:00'},{id:'a',status:'draft',starts_at:'2026-12-15T10:00:00'},{id:'c',status:'draft',starts_at:null},{id:'d',status:'draft',starts_at:'2026-11-10T10:00:00'},{id:'e',status:'cancelled',starts_at:'2026-12-15T09:00:00'}];
test('upcoming private drafts are ordered, undated and past drafts excluded',()=>{assert.deepEqual(upcomingRows(rows,Date.parse('2026-12-01T00:00:00')).map(w=>w.id),['a','b']);assert.equal(rows.length,5);});
test('calendar uses the device local date and excludes non-drafts',()=>{assert.deepEqual(rowsOnDate(rows,'2026-12-15').map(w=>w.id),['a','b']);assert.deepEqual(rowsOnDate(rows,'2026-12-16'),[]);});
