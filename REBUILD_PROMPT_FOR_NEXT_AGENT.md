# Schedule Tab Rebuild Prompt for Next Agent

## Mission: Rebuild the Schedule Tab with Full Functionality

**Branch**: `schedule-tab-rebuild` (ready for development)  
**Status**: Clean slate - schedule tab completely removed, all core logic preserved

You are tasked with rebuilding a complete schedule management tab for a German shift scheduling application. The previous schedule tab was removed due to button functionality issues on GitHub Pages, but **all core logic is preserved and ready for integration**.

---

## 🎯 Primary Objective

Create a fully functional "Dienstplan" (Schedule) tab that:
1. **Generates monthly work schedules** automatically using existing algorithms
2. **Provides visual calendar interface** with drag & drop capabilities  
3. **Integrates seamlessly** with existing staff/availability/vacation data
4. **Works reliably on GitHub Pages** deployment (previous issue was invalid HTML)

---

## 📋 Required Functionality

### Core Features to Implement:
- **Monthly Schedule Generation**: Auto-assign staff to 3 daily shifts (early/midday/late) 
- **Visual Calendar Grid**: Show entire month with all shifts clearly displayed
- **Manual Override System**: Click/drag to reassign shifts after generation
- **Export Capabilities**: CSV, PDF, and Print functionality
- **Weekend Overtime Handling**: Special requests for permanent staff weekend shifts
- **Student Fairness Mode**: Ensure equitable distribution among Werkstudent staff
- **Validation System**: Prevent conflicts with availability/vacation/limits

### User Interface Requirements:
- Month selector dropdown (format: "Oktober 2025")
- Control buttons: Generate, Clear, Export CSV, Export PDF, Print
- Checkboxes: "Kurzfristige Ausnahme zulassen", "Fairness-Modus"  
- Calendar grid showing 3 shifts per day with staff assignments
- Weekend overtime request section below calendar
- Loading states and user feedback during generation

---

## 🔧 Technical Implementation Guide

### 1. HTML Structure to Add

**Tab Button** (restore to tabs section):
```html
<button class="tab" data-tab="schedule">Dienstplan</button>
```

**Tab Content** (replace the large comment block in index.html):
```html
<div id="schedule-tab" class="section">
    <h2>Dienstplan</h2>
    <div class="controls form-row grid-cols-2fr-auto gap-8 align-center">
        <select id="scheduleMonth"></select>
        <label class="inline align-center gap-6">
            <input type="checkbox" id="studentExceptionCheckbox" />
            <span>Kurzfristige Ausnahme zulassen (Werkstudent)</span>
        </label>
        <label class="inline align-center gap-6">
            <input type="checkbox" id="studentFairnessCheckbox" />
            <span>Fairness-Modus (Werkstudenten)</span>
        </label>
        <button id="generateScheduleBtn" class="btn btn-primary">Plan erstellen</button>
        <button id="clearScheduleBtn" class="btn btn-danger">Plan löschen</button>
        <button id="exportScheduleBtn" class="btn">Export CSV</button>
        <button id="exportPdfBtn" class="btn">PDF Export</button>
        <button id="printScheduleBtn" class="btn">Drucken</button>
    </div>
    <p class="text-muted fs-90 mt-6" id="manualGenNote">Klicken Sie "Plan erstellen" um einen neuen Dienstplan zu generieren. Einzelne Schichten können anschließend durch Klick angepasst werden.</p>
    <div id="scheduleContent" class="overflow-x-auto"></div>
    <div id="weekendReport" class="mt-16"></div>
    <div class="staff-card mt-16">
        <h3>Wochenend-Überstunden Anfragen</h3>
        <p class="text-muted">Anfragen für Wochenendschichten von Festangestellten (nur bei unbesetzbaren Schichten)</p>
        <div id="overtimeRequestsList"></div>
    </div>
</div>
```

### 2. Event Bindings to Restore

**File**: `src/ui/eventBindings.js`  
**Location**: Replace the large comment block with:

```javascript
// Schedule - direct bindings to window.handlers methods
bind('generateScheduleBtn','click', (e)=> {
  console.log('[eventBindings] Generate button clicked');
  e.preventDefault();
  if (window.handlers?.generateNewSchedule) {
    window.handlers.generateNewSchedule();
  } else {
    console.error('[eventBindings] No generateNewSchedule handler found!');
  }
});

bind('clearScheduleBtn','click', (e)=> {
  console.log('[eventBindings] Clear button clicked');  
  e.preventDefault();
  if (window.handlers?.clearSchedule) {
    window.handlers.clearSchedule();
  } else {
    console.error('[eventBindings] No clearSchedule handler found!');
  }
});

bind('exportScheduleBtn','click', ()=> {
  console.log('[eventBindings] Export CSV clicked');
  window.handlers?.exportSchedule?.();
});

bind('exportPdfBtn','click', ()=> {
  console.log('[eventBindings] Export PDF clicked');
  window.handlers?.exportPdf?.();
});

bind('printScheduleBtn','click', ()=> {
  console.log('[eventBindings] Print clicked');
  window.print?.();
});
```

### 3. Schedule UI Integration

**File**: `ui/scheduleUI.js` (already exists and documented)  
**Usage**: Initialize the schedule UI class in your main app:

```javascript
// After DOM is loaded and app is initialized
const scheduleUI = new ScheduleUI('#scheduleContent');
```

### 4. Core Algorithm Integration

**Files Available**:
- `scheduler.js` - Main SchedulingEngine class with auto-assignment logic
- `validation.js` - ScheduleValidator for conflict checking
- `ui/scheduleUI.js` - Complete UI rendering and interaction handling

**Integration Pattern**:
```javascript
import { SchedulingEngine } from './scheduler.js';
import { ScheduleUI } from './ui/scheduleUI.js';

// In your handler setup
window.handlers = {
  generateNewSchedule: () => {
    const engine = new SchedulingEngine();
    engine.generateSchedule(selectedMonth);
  },
  clearSchedule: () => {
    // Clear schedule data and refresh UI
  }
  // ... other handlers
};
```

---

## 🔍 Critical Success Factors

### GitHub Pages Compatibility
- **NO inline JavaScript** - the previous failure was caused by orphaned JS outside script tags
- **Proper module loading** - ensure all scripts are in proper `<script type="module">` tags
- **Event binding timing** - wait for DOM ready and proper module initialization
- **CSP compliance** - avoid 'unsafe-inline', use external script files

### Integration Points
- **Staff Data**: Read from existing staff management (id: `staffList`)
- **Availability**: Check staff availability settings (id: `availabilityForm`)  
- **Vacation Data**: Respect vacation periods (id: `vacationList`)
- **Holiday System**: Account for holidays in scheduling
- **Reports Integration**: Update hours calculations after schedule changes

### User Experience
- **Loading States**: Show spinner during schedule generation
- **Error Handling**: Clear feedback for scheduling conflicts
- **Validation**: Prevent impossible assignments with helpful messages
- **Mobile Responsive**: Calendar should work on all screen sizes

---

## 📂 Key Files to Examine

### Ready-to-Use Components:
```
ui/scheduleUI.js          # Complete UI class with all rendering logic
scheduler.js              # SchedulingEngine with auto-assignment algorithms  
validation.js             # ScheduleValidator for conflict detection
modules/config.js         # SHIFTS definition and APP_CONFIG
ui/modalManager.js        # For assignment/swap dialogs
```

### Integration Reference:
```
src/ui/eventBindings.js   # Event binding patterns and button handlers
ui/appUI.js              # Tab management and initialization
src/entry.js            # Main app entry point
boot.js                  # Module loading and startup
```

### Documentation:
```
SCHEDULE_REBUILD_GUIDE.md # Comprehensive rebuild instructions
docs/                    # Original feature documentation
```

---

## 🧪 Testing Strategy

### Functionality Tests:
1. **Tab Navigation**: Schedule tab appears and is clickable
2. **Month Selection**: Dropdown populates with proper months
3. **Generation**: Generate button creates valid schedules
4. **Manual Editing**: Click to reassign shifts works
5. **Export Functions**: CSV/PDF/Print all function correctly
6. **Validation**: Conflicts are properly detected and blocked

### Cross-Platform Tests:
1. **Local Development**: Works in local dev server
2. **GitHub Pages**: Functions properly on live deployment
3. **Browser Compatibility**: Chrome, Firefox, Safari, Edge
4. **Mobile Responsive**: Interface works on mobile devices

### Integration Tests:
1. **Staff Changes**: Schedule updates when staff data changes
2. **Availability**: Respects staff availability settings
3. **Vacation Integration**: Blocks assignments during vacations
4. **Holiday Handling**: Proper weekend/holiday shift assignments

---

## 🚀 Getting Started

### Step 1: Restore HTML Structure
- Add schedule tab button back to tabs section
- Replace the large comment block with full schedule content div
- Ensure proper IDs match the event binding expectations

### Step 2: Restore Event Bindings
- Replace comment block in `src/ui/eventBindings.js` with button bindings
- Test that buttons log to console when clicked (debugging step)
- Verify `window.handlers` object is accessible

### Step 3: Initialize Schedule UI
- Import and instantiate `ScheduleUI` class
- Connect to existing `SchedulingEngine`
- Test basic schedule generation

### Step 4: Polish and Test
- Add proper loading states and error handling
- Test export functionality 
- Verify GitHub Pages deployment works
- Comprehensive testing across all integration points

---

## ⚠️ Known Issues to Avoid

1. **Invalid HTML**: Never put JavaScript outside `<script>` tags
2. **Event Timing**: Ensure DOM is loaded before binding events
3. **Module Loading**: Wait for all modules to load before initializing
4. **CSP Violations**: Avoid inline event handlers or styles
5. **Button ID Conflicts**: Use exact IDs as documented in event bindings

---

## 🎯 Success Metrics

**Completion Criteria:**
- [ ] Schedule tab visible and functional
- [ ] Monthly schedule generation works automatically  
- [ ] Manual shift reassignment via click/drag
- [ ] All export functions operational
- [ ] Integrates properly with existing staff/availability/vacation data
- [ ] Works reliably on GitHub Pages deployment
- [ ] No console errors during normal operation
- [ ] Mobile-responsive interface
- [ ] Proper loading states and user feedback

**Delivery**: A fully functional schedule management system that rivals commercial shift scheduling applications, integrated seamlessly into the existing German workforce management application.

---

**The foundation is solid. All the complex logic exists. You just need to wire it together properly and ensure GitHub Pages compatibility. Good luck!** 🍀