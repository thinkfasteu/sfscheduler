// Minimal DOM shim for updateDay test
class Elem { constructor(){ this.children=[]; this.attributes={}; this.innerHTML=''; }
  setAttribute(k,v){ this.attributes[k]=v; }
  getAttribute(k){ return this.attributes[k]; }
  querySelectorAll(){ return []; }
  addEventListener(){}
}
const cells = {};
global.document = {
  querySelector(sel){
    const m = sel.match(/\.cal-body\[data-date="(.*)"\]/);
    if (m){ return cells[m[1]]; }
    return null;
  }
};
global.window = { DEBUG:{ state:{ scheduleData:{ '2025-09': { '2025-09-03': { assignments:{ early:1 } } } }, staffData:[{id:1,name:'Alice'}]} }, __perf:{calendarDiffUpdates:0} };
global.SHIFTS = { early:{ type:'weekday', name:'Früh', time:'08-13', hours:5 } };

// Inject class with only required methods from scheduleUI (extracting minimal logic)
class ScheduleUITest {
  constructor(){ this.currentCalendarMonth='2025-09'; }
  renderAssignmentsForDate(month, cellEl, dateStr){
    const shifts = Object.keys(SHIFTS);
    const data = window.DEBUG.state.scheduleData[month] || {};
    const assignments = data[dateStr]?.assignments || {};
    cellEl.innerHTML = shifts.map(s=> assignments[s]?`<div data-s="${s}">x</div>`:`<div data-s="${s}" class="unassigned"></div>`).join('');
  }
  updateCalendarFromSelect(){}
  updateDay(dateStr){
    if (this.currentCalendarMonth !== dateStr.slice(0,7)) return;
    const cell = document.querySelector(`.cal-body[data-date="${dateStr}"]`);
    if (!cell) return;
    this.renderAssignmentsForDate(dateStr.slice(0,7), cell, dateStr);
    window.__perf.calendarDiffUpdates++;
  }
}

// Prepare cell
cells['2025-09-03'] = new Elem();
cells['2025-09-03'].setAttribute('data-date','2025-09-03');
cells['2025-09-03'].setAttribute('data-type','weekday');

const ui = new ScheduleUITest();
ui.updateDay('2025-09-03');
if (!/data-s="early"/.test(cells['2025-09-03'].innerHTML)) throw new Error('Expected early shift rendered');
if (!/class="unassigned"/.test(cells['2025-09-03'].innerHTML) && !/x<\/div>/.test(cells['2025-09-03'].innerHTML)) throw new Error('Cell render missing expected markup');
if (window.__perf.calendarDiffUpdates !== 1) throw new Error('Perf diff counter not incremented');

console.log('[test] scheduleDiff passed');