# FTG Tools Launch Checklist

## Pre-Launch Steps

1. File Structure Verification
   - [ ] Confirm all files are in correct locations:
     ```
     FTG tools/
     ├── js/
     │   ├── modules/
     │   │   ├── config.js
     │   │   └── state.js
     │   ├── utils/
     │   │   └── dateUtils.js
     │   ├── scheduler.js
     │   ├── types.js
     │   └── main.js
     ├── index.html
     └── package.json
     ```

2. Dependencies Check
   - [ ] Open terminal in `FTG tools` folder
   - [ ] Run: `cd "c:\Users\voice\Documents\augment-projects\FTG tools"`
   - [ ] Run: `npm install`
   - [ ] Verify package.json exists and is valid

3. Testing
   - [ ] Run unit tests: `npm test`
   - [ ] Verify all tests pass with no errors
   - [ ] Fix any failed tests before proceeding

## Launch Steps

1. Local Testing
   - [ ] Open index.html in browser
   - [ ] Press F12 to open DevTools
   - [ ] Check console for any errors
   - [ ] Verify DEBUG object exists in console: `console.log(window.DEBUG)`

2. Basic Functionality Test
   - [ ] Add a test staff member
   - [ ] Set availability for next month
   - [ ] Generate a test schedule
   - [ ] Verify assignments appear correctly

3. Data Persistence Test
   - [ ] Make some changes to schedule
   - [ ] Refresh page
   - [ ] Verify changes persisted
   - [ ] Check localStorage in DevTools

## Post-Launch Verification

1. Core Features
   - [ ] Schedule generation works
   - [ ] Staff availability can be set
   - [ ] Changes are saved
   - [ ] UI updates correctly

2. Error Handling
   - [ ] Try invalid inputs
   - [ ] Verify error messages appear
   - [ ] Check error logging works

3. Performance Check
   - [ ] Generate large schedule
   - [ ] Verify reasonable response time
   - [ ] Check memory usage in DevTools

## Troubleshooting Guide

If issues occur:

1. Console Errors
   - Open browser DevTools (F12)
   - Check Console tab for errors
   - Note exact error messages

2. State Issues
   - Check localStorage content
   - Try clearing data: `localStorage.clear()`
   - Reload page

3. Schedule Generation Issues
   - Check staff availability data
   - Verify shift configurations
   - Review validation rules

## Support Contacts

- Technical Issues: [Add contact]
- User Support: [Add contact]
- Emergency: [Add contact]

## Rollback Plan

If critical issues occur:
1. Notify users immediately
2. Clear localStorage
3. Reload previous working version
4. Contact technical support
