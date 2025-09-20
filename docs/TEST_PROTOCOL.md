# FTG Sportfabrik Smart Staff Scheduler - Test Protocol

**Version:** 1.0  
**Date:** September 2025  
**Status:** Pilot Readiness Testing  

## Overview

This document provides comprehensive testing procedures for validating all business rules, edge cases, and performance requirements in the FTG Sportfabrik Smart Staff Scheduler. Each test case follows the pattern: **Input → Expected Output** with clear pass/fail criteria.

## Test Environment Setup

### Prerequisites
- Clean database with migration 008 applied (practical weekly hour limits)
- Sample staff data with all contract types
- Test data spanning multiple weeks
- Monitoring dashboard enabled

### Test Data Requirements
```javascript
Staff Test Data:
- Minijob: "Max Mustermann" (Contract: 10h/week, Practical: 8-12h/week)
- Werkstudent: "Anna Weber" (Contract: 20h/week, Practical: 18-22h/week)  
- Permanent: "Klaus Schmidt" (Contract: 40h/week, Practical: 36-44h/week)
- Holiday worker: "Lisa Park" (Temporary contract)
```

---

## 1. Rest Period Business Rules (11 Hours)

### Test Case 1.1: Valid Rest Period
**Rule:** Minimum 11 hours between shifts  
**Input:**
- Staff: Max Mustermann
- Shift 1: Monday 08:00-16:00 (end: 16:00)
- Shift 2: Tuesday 06:00-14:00 (start: 06:00)
- Time gap: 14 hours

**Expected Output:** ✅ PASS - Assignment allowed  
**Validation:** No rest period violation warning

### Test Case 1.2: Rest Period Violation
**Input:**
- Shift 1: Monday 08:00-20:00 (end: 20:00)
- Shift 2: Tuesday 06:00-14:00 (start: 06:00)
- Time gap: 10 hours

**Expected Output:** ❌ FAIL - Assignment blocked  
**Validation:** Red warning displayed: "Ruhezeit-Verletzung: Nur 10h zwischen Schichten (mindestens 11h erforderlich)"

### Test Case 1.3: Cross-Week Rest Period
**Input:**
- Shift 1: Sunday 18:00-22:00 (end: 22:00)
- Shift 2: Monday 08:00-16:00 (start: 08:00)
- Time gap: 10 hours across week boundary

**Expected Output:** ❌ FAIL - Assignment blocked  
**Validation:** Rest period validation works across week transitions

### Test Case 1.4: Rest Period with Existing Schedule (Bug Fix)
**Input:**
- Existing schedule with past shifts
- Cutoff date: Current week start
- New assignment respects only current/future shifts

**Expected Output:** ✅ PASS - Historical shifts ignored  
**Validation:** `seedTrackersFromExistingSchedule()` uses cutoff parameter correctly

---

## 2. Maximum Consecutive Days (6 Days)

### Test Case 2.1: Valid Consecutive Days
**Input:**
- Staff: Anna Weber (Werkstudent)
- Assignments: Monday through Friday (5 consecutive days)

**Expected Output:** ✅ PASS - Assignment allowed  
**Validation:** No consecutive day warning

### Test Case 2.2: Maximum Consecutive Days Reached
**Input:**
- Assignments: Monday through Saturday (6 consecutive days)

**Expected Output:** ⚠️ WARNING - Maximum reached  
**Validation:** Yellow warning: "Maximale Arbeitstage erreicht (6 Tage hintereinander)"

### Test Case 2.3: Consecutive Days Violation
**Input:**
- Assignments: Monday through Sunday (7 consecutive days)

**Expected Output:** ❌ FAIL - Assignment blocked  
**Validation:** Red error: "Überschreitung: Mehr als 6 aufeinanderfolgende Arbeitstage"

### Test Case 2.4: Consecutive Days Reset
**Input:**
- Days 1-6: Working
- Day 7: Free day
- Day 8: Working (resets counter)

**Expected Output:** ✅ PASS - Counter reset after free day  
**Validation:** Consecutive day counter resets properly

---

## 3. Werkstudent Weekly 20H Rules

### Test Case 3.1: Standard 20H Week
**Input:**
- Staff: Anna Weber (Werkstudent, Contract: 20h, Practical: 18-22h)
- Weekly assignments totaling 20 hours

**Expected Output:** ✅ PASS - Target met  
**Validation:** Green status indicator, optimal score

### Test Case 3.2: Within Practical Limits
**Input:**
- Weekly assignments totaling 19 hours (within 18-22h range)

**Expected Output:** ✅ PASS - Within practical limits  
**Validation:** Target calculated as average of practical limits (20h)

### Test Case 3.3: Semester Break Exception
**Input:**
- Academic period: Semester break
- Weekly assignments totaling 35 hours

**Expected Output:** ✅ PASS - Exception rules apply  
**Validation:** Academic term detection allows increased hours

### Test Case 3.4: Below Practical Minimum
**Input:**
- Weekly assignments totaling 16 hours (below 18h minimum)

**Expected Output:** ⚠️ WARNING - Below practical minimum  
**Validation:** Yellow warning about insufficient hours

### Test Case 3.5: Above Practical Maximum (Non-Break)
**Input:**
- Academic period: Regular semester
- Weekly assignments totaling 25 hours (above 22h maximum)

**Expected Output:** ❌ FAIL - Exceeds practical limits  
**Validation:** Red error: "Überschreitung der praktischen Wochenstunden"

---

## 4. Minijob Weekly Targeting (10H ±1.5H)

### Test Case 4.1: Perfect Target Hit
**Input:**
- Staff: Max Mustermann (Minijob, Contract: 10h, Practical: 8-12h)
- Weekly assignments totaling 10 hours

**Expected Output:** ✅ PASS - Perfect target  
**Validation:** Highest priority score, green indicator

### Test Case 4.2: Within Tolerance Range
**Input:**
- Weekly assignments totaling 9 hours (within 8.5-11.5h tolerance)

**Expected Output:** ✅ PASS - Within tolerance  
**Validation:** Good score, acceptable variance

### Test Case 4.3: Below Minimum Practical
**Input:**
- Weekly assignments totaling 7 hours (below 8h practical minimum)

**Expected Output:** ⚠️ WARNING - Below practical minimum  
**Validation:** Warning displayed, reduced priority score

### Test Case 4.4: Above Maximum Practical
**Input:**
- Weekly assignments totaling 13 hours (above 12h practical maximum)

**Expected Output:** ❌ FAIL - Exceeds Minijob limits  
**Validation:** Red error, assignment blocked

### Test Case 4.5: Earnings Warning with Swap
**Input:**
- Attempt to swap shift that would exceed monthly earnings limit
- Minijob monthly earning approaching 520€ limit

**Expected Output:** ⚠️ WARNING - Earnings confirmation required  
**Validation:** Swap proceeds only after user confirms understanding of earnings impact

---

## 5. Holiday Shift Logic

### Test Case 5.1: Public Holiday Detection
**Input:**
- Shift on recognized public holiday (e.g., Christmas Day)
- Staff with holiday work permissions

**Expected Output:** ✅ PASS - Holiday shift allowed  
**Validation:** Holiday premium rate applied, special marking in schedule

### Test Case 5.2: Holiday Consent Required
**Input:**
- Weekend holiday shift assignment
- Staff without explicit holiday consent

**Expected Output:** ⚠️ CONSENT REQUIRED - Manual approval needed  
**Validation:** "Zustimmung für diesen Tag anfragen" checkbox appears

### Test Case 5.3: Holiday Hours Counting
**Input:**
- Holiday shift with overtime implications
- Weekend consent provided

**Expected Output:** ✅ PASS - Hours counted as overtime  
**Validation:** "Bei Zustimmung werden diese Wochenendstunden als Überstunden gezählt"

### Test Case 5.4: Holiday Restriction
**Input:**
- Attempt to assign holiday shift to staff with holiday restrictions

**Expected Output:** ❌ FAIL - Holiday work restricted  
**Validation:** Clear message about holiday work limitations

---

## 6. Permanent Staff Tolerance (±4H Weekly, ±2H Monthly)

### Test Case 6.1: Weekly Tolerance Within Limits
**Input:**
- Staff: Klaus Schmidt (Permanent, Contract: 40h, Practical: 36-44h)
- Weekly assignment: 42 hours (within 36-44h range)

**Expected Output:** ✅ PASS - Within weekly tolerance  
**Validation:** Green indicator, acceptable variance

### Test Case 6.2: Weekly Tolerance Exceeded
**Input:**
- Weekly assignment: 46 hours (exceeds 44h practical maximum)

**Expected Output:** ⚠️ WARNING - Weekly tolerance exceeded  
**Validation:** Yellow warning, requires justification

### Test Case 6.3: Monthly Tolerance Tracking
**Input:**
- Month 1: 42h average weekly (168h monthly vs 160h target)
- Within ±8h monthly tolerance (152-168h range)

**Expected Output:** ✅ PASS - Monthly tolerance OK  
**Validation:** Monthly tracking displays cumulative variance

### Test Case 6.4: Monthly Tolerance Exceeded
**Input:**
- Monthly total: 180 hours (exceeds 168h maximum)

**Expected Output:** ❌ FAIL - Monthly limit exceeded  
**Validation:** Red error, assignment blocked or flagged for approval

---

## 7. Schedule Generation and Optimization

### Test Case 7.1: Fair Distribution Algorithm
**Input:**
- Multiple staff available for weekend shifts
- Equal qualifications and availability

**Expected Output:** ✅ PASS - Balanced weekend distribution  
**Validation:** Weekend shifts distributed fairly across staff over time

### Test Case 7.2: Preference Consideration
**Input:**
- Staff A: Weekend preference = "prefers"
- Staff B: Weekend preference = "avoids"
- Weekend shift to assign

**Expected Output:** ✅ PASS - Staff A gets priority  
**Validation:** Preference weights influence assignment scoring

### Test Case 7.3: Multiple Constraint Satisfaction
**Input:**
- Complex schedule with overlapping constraints
- Rest periods, consecutive days, weekly hours all considered

**Expected Output:** ✅ PASS - All constraints satisfied  
**Validation:** No violations in generated schedule

### Test Case 7.4: Impossible Schedule Handling
**Input:**
- Over-constrained scenario (insufficient staff for requirements)

**Expected Output:** ⚠️ PARTIAL - Best effort assignment  
**Validation:** Clear indication of unfilled shifts, explanatory warnings

---

## 8. Monitoring and Performance

### Test Case 8.1: Schedule Generation Performance
**Input:**
- Schedule generation for full week with 20+ staff

**Expected Output:** ✅ PASS - Generation completes within 5 seconds  
**Validation:** Performance metrics recorded in monitoring dashboard

### Test Case 8.2: Health Status Monitoring
**Input:**
- System under normal operation

**Expected Output:** ✅ PASS - Green health status  
**Validation:** Dashboard shows "Healthy" status with all metrics green

### Test Case 8.3: Error Rate Tracking
**Input:**
- Various operations including some failed assignments

**Expected Output:** ✅ PASS - Error rate < 5%  
**Validation:** Monitoring dashboard tracks and displays error percentages

### Test Case 8.4: API Call Auditing
**Input:**
- External API calls via FTG_SCHEDULER_API namespace

**Expected Output:** ✅ PASS - All calls logged  
**Validation:** API call history available in monitoring dashboard

---

## 9. User Interface and Experience

### Test Case 9.1: Swap Confirmation Flow
**Input:**
- Attempt to swap Minijob shifts with earnings implications

**Expected Output:** ✅ PASS - Warning dialog appears  
**Validation:** User can confirm understanding and proceed or cancel

### Test Case 9.2: Practical Limits Display
**Input:**
- View staff form for Minijob or Werkstudent

**Expected Output:** ✅ PASS - Practical limits fields visible  
**Validation:** Form shows conditional practical limits based on staff type

### Test Case 9.3: Reports Enhancement
**Input:**
- Generate staff reports with practical vs contract hours

**Expected Output:** ✅ PASS - Both hour types displayed  
**Validation:** Reports clearly distinguish between contract and practical hours

### Test Case 9.4: Monitoring Dashboard Access
**Input:**
- Navigate to Monitoring tab

**Expected Output:** ✅ PASS - Real-time dashboard loads  
**Validation:** Dashboard displays current metrics, auto-refreshes, export works

---

## 10. Data Integrity and Migration

### Test Case 10.1: Migration 008 Validation
**Input:**
- Database with migration 008 applied

**Expected Output:** ✅ PASS - New columns exist  
**Validation:** `weekly_hours_min_practical`, `weekly_hours_max_practical`, `notes_practical_caps` columns present

### Test Case 10.2: Backward Compatibility
**Input:**
- Staff records without practical limits set

**Expected Output:** ✅ PASS - Graceful fallback to contract hours  
**Validation:** System uses contract hours when practical limits are null

### Test Case 10.3: Data Validation
**Input:**
- Invalid practical limits (min > max)

**Expected Output:** ❌ FAIL - Validation error  
**Validation:** Clear error message, data entry prevented

### Test Case 10.4: Audit Trail Integrity
**Input:**
- Various system operations

**Expected Output:** ✅ PASS - Complete audit log  
**Validation:** All changes tracked with timestamps, user IDs, and operation details

---

## Performance Benchmarks

### Minimum Performance Requirements
- **Schedule Generation:** < 5 seconds for 50 staff, 1 week
- **UI Response Time:** < 500ms for most operations
- **Database Query Time:** < 100ms for standard queries
- **Memory Usage:** < 100MB client-side after full initialization
- **Error Rate:** < 1% for normal operations

### Load Testing Scenarios
1. **Concurrent Users:** 10 simultaneous users making schedule changes
2. **Large Dataset:** 100+ staff, 4-week scheduling horizon
3. **Rapid Operations:** 50 consecutive swap operations
4. **Memory Stress:** Extended session with multiple schedule generations

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Database migration 008 applied and verified
- [ ] Test data loaded (all staff types represented)
- [ ] Monitoring dashboard accessible
- [ ] Browser developer tools ready for performance monitoring
- [ ] Test environment isolated from production

### Core Business Rules Testing
- [ ] All rest period test cases (1.1-1.4)
- [ ] All consecutive days test cases (2.1-2.4)
- [ ] All Werkstudent rules test cases (3.1-3.5)
- [ ] All Minijob targeting test cases (4.1-4.5)
- [ ] All holiday logic test cases (5.1-5.4)
- [ ] All permanent staff tolerance test cases (6.1-6.4)

### System Integration Testing
- [ ] Schedule generation and optimization (7.1-7.4)
- [ ] Monitoring and performance (8.1-8.4)
- [ ] User interface flows (9.1-9.4)
- [ ] Data integrity (10.1-10.4)

### Performance Testing
- [ ] All performance benchmarks met
- [ ] Load testing scenarios completed
- [ ] Memory usage within limits
- [ ] No memory leaks detected

### Documentation Verification
- [ ] All error messages clear and actionable
- [ ] Help text accurate and helpful
- [ ] Monitoring dashboard intuitive for non-technical users
- [ ] Reports format suitable for management review

---

## Test Results Template

### Test Case: [ID and Name]
**Date:** [Date]  
**Tester:** [Name]  
**Environment:** [Development/Staging/Pre-Production]

**Result:** ✅ PASS / ❌ FAIL / ⚠️ PARTIAL

**Actual Output:**
[Description of what actually happened]

**Issues Found:**
[Any deviations from expected behavior]

**Screenshots/Evidence:**
[Any supporting documentation]

**Follow-up Actions:**
[Required fixes or additional testing]

---

## Sign-off

### Technical Validation
- [ ] All core business rules tested and passing
- [ ] Performance benchmarks met
- [ ] No critical bugs identified
- [ ] Monitoring and audit trails functional

**Technical Lead:** _________________ Date: _________

### Business Validation
- [ ] Business rules correctly implemented
- [ ] User experience meets requirements
- [ ] Reports provide necessary management insights
- [ ] GDPR compliance maintained

**Business Owner:** _________________ Date: _________

### Pilot Readiness Approval
- [ ] All test cases completed successfully
- [ ] Documentation complete and accurate
- [ ] Staff training materials reviewed
- [ ] Incident response procedures tested

**Project Manager:** _________________ Date: _________

---

**Document Version Control:**
- v1.0 - Initial pilot readiness testing protocol
- Last Updated: September 2025
- Next Review: Post-pilot evaluation