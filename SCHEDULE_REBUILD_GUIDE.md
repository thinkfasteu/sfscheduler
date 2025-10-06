# Schedule Tab Rebuild Guide

## Status: REMOVED - Ready for Clean Rebuild

The schedule tab has been completely removed due to button functionality issues on GitHub Pages. All related code is preserved and ready for integration.

## What Was Removed

### HTML Structure (index.html)
- Schedule tab button and content section removed
- Detailed rebuild notes added in comments

### Event Bindings (src/ui/eventBindings.js) 
- All schedule button events removed
- Comprehensive binding pattern examples left in comments
- Button IDs documented for rebuild:
  - `generateScheduleBtn`
  - `clearScheduleBtn` 
  - `exportScheduleBtn`
  - `exportPdfBtn`
  - `printScheduleBtn`

### TypeScript Code Removed
- `apps/staff-portal/` directory completely removed
- Package.json scripts cleaned up

## What Was Preserved

### Core Schedule Logic (Ready to Use)
- `scheduler.js` - Main scheduling algorithm
- `ui/scheduleUI.js` - Complete UI rendering class 
- `validation.js` - Schedule validation logic
- All integration points with staff/availability/vacation tabs

### Working Integration Points
- Staff data management (staff-tab)
- Availability system (availability-tab)
- Vacation tracking (vacation-tab)
- Holiday management system
- Supabase backend integration

## Rebuild Steps

### 1. Add Schedule Tab Back to HTML
```html
<button class="tab" data-tab="schedule">Dienstplan</button>
```

### 2. Add Schedule Content Section
```html
<div id="schedule-tab" class="section">
    <!-- Month selector -->
    <!-- Generate/Clear/Export buttons -->  
    <!-- Schedule content area -->
    <!-- Weekend overtime requests -->
</div>
```

### 3. Restore Event Bindings
Use the pattern documented in `src/ui/eventBindings.js`:
```javascript
bind('generateScheduleBtn', 'click', (e) => {
    if (window.handlers?.generateNewSchedule) {
        window.handlers.generateNewSchedule();
    }
});
```

### 4. Initialize Schedule UI
```javascript
// In your main app initialization
const scheduleUI = new ScheduleUI('#scheduleContent');
```

## Known Issues to Avoid

### GitHub Pages vs Netlify
- Buttons worked on Netlify but failed on GitHub Pages
- Issue was likely invalid HTML from orphaned JavaScript
- Ensure proper script tag wrapping
- Test event binding timing carefully

### Event Binding Pattern That Worked
- Direct binding via `bind()` helper function
- Debug alerts confirmed events were firing
- Integration via `window.handlers` object pattern

### CSP Compliance
- Remove any inline JavaScript
- Use proper external script files
- Current CSP allows 'unsafe-inline' temporarily for debugging

## File Structure for Reference

```
ui/scheduleUI.js          # Complete UI rendering logic
scheduler.js              # Core scheduling algorithm  
src/ui/eventBindings.js   # Event binding patterns
validation.js             # Schedule validation
modules/config.js         # Shift definitions
```

## Testing Checklist

1. [ ] Schedule tab appears and is clickable
2. [ ] Month selector populates correctly  
3. [ ] Generate button triggers schedule creation
4. [ ] Calendar renders with proper grid
5. [ ] Staff assignments display correctly
6. [ ] Export functions work
7. [ ] Test on both local dev and GitHub Pages deployment

## Integration Notes

The schedule system integrates with:
- **Staff Data**: Reads from staff management tab
- **Availability**: Respects staff availability settings  
- **Vacation**: Blocks assignments during vacation
- **Holidays**: Handles holiday shift assignments
- **Reports**: Updates monthly hours calculations

All integration code is preserved and ready to use.