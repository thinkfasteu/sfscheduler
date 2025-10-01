# CHANGELOG

All notable changes to the FTG Sportfabrik Smart Staff Scheduler are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - Pilot Readiness Release

### Major Features Added

#### 🛡️ GDPR Compliance Framework
- **Complete GDPR documentation suite** for audit readiness
- Comprehensive privacy policies in German and English
- Records of Processing Activities (ROPA) with 6 processing categories
- Data retention schedules and deletion procedures
- Consent management workflows and subject rights procedures
- Data Protection Impact Assessment (DPIA) framework
- Incident response procedures and breach notification protocols
- Data processor agreements and third-party compliance

#### 📊 Practical Weekly Hour Limits System
- **Database Migration 008**: Added practical weekly hour limits to contracts table
  - `weekly_hours_min_practical` - Practical minimum weekly hours
  - `weekly_hours_max_practical` - Practical maximum weekly hours  
  - `notes_practical_caps` - Notes for practical hour justifications
- **Enhanced Staff Management**: Conditional form fields based on contract type
  - Minijob: 8-12 hour practical ranges typical
  - Werkstudent: 18-22 hour practical ranges typical
  - Permanent: ±4 hour weekly tolerance from contract hours
- **Scheduler Integration**: `getEffectiveWeeklyLimits()` method with target calculation
  - Target hours calculated as average of practical min/max limits
  - Improved assignment scoring based on practical vs. contract hours
- **Reports Enhancement**: Displays both contract and practical hours for transparency

#### 🔧 Operational Monitoring & Hardening
- **Comprehensive MonitoringService** with real-time metrics tracking
  - Schedule generation performance monitoring
  - Assignment operation tracking (swaps, overrides, violations)
  - System health assessment and validation issue recording
  - Business metrics collection (hour violations, rest period issues)
  - API call auditing and usage statistics
- **Real-time Monitoring Dashboard** with auto-refresh capabilities
  - Health status indicators with color-coded alerts
  - Performance metrics visualization
  - Business rule violation summaries
  - Export functionality for management reporting
  - Navigation integration as dedicated "Monitoring" tab
- **Public API Namespace** (`window.FTG_SCHEDULER_API`) for external integrations
  - Staff management endpoints with data sanitization
  - Schedule and availability query interfaces
  - Vacation and overtime reporting APIs
  - Health check and monitoring access points
  - Comprehensive audit logging for all API calls

### Critical Bug Fixes

#### 🚨 Rest Period Calculation Fix
- **Fixed rest-period validation bug** in `seedTrackersFromExistingSchedule()`
- Added `cutoffDate` parameter to filter only relevant existing shifts
- Prevents false violations when comparing new shifts with historical data
- Ensures accurate 11-hour rest period enforcement between consecutive shifts

#### ⚠️ Minijob Swap Warning Enhancement  
- **Converted hard blocking to user-friendly warnings** for Minijob shift swaps
- Added earnings impact confirmation dialogs
- Integrated monitoring tracking for swap warning decisions
- Maintains compliance while improving operational flexibility

### Enhanced User Experience

#### 🎯 Smart Form Behavior
- **Conditional practical limits display** based on staff contract type
- Auto-hiding irrelevant fields for permanent staff contracts
- Enhanced validation with practical vs. contract hour comparisons
- Improved user guidance for hour limit configurations

#### 📈 Advanced Reporting
- **Dual hour tracking** showing contract vs. practical hours
- Management-friendly format for capacity planning
- Clear distinction between theoretical and achievable weekly targets
- Enhanced overtime and compliance reporting

### Technical Improvements

#### 🔗 Enhanced Integration Capabilities
- **Standardized external API interface** for third-party systems
- Audit trail compliance for all public API operations
- Rate limiting preparation and security consideration documentation
- Clean data sanitization for external consumption

#### 📝 Comprehensive Documentation
- **Complete test protocol** with 80+ test cases covering all business rules
- Input → Expected Output validation for rest periods, consecutive days, weekly hours
- Performance benchmarking requirements and load testing scenarios
- **Pilot readiness guide** with operational procedures and compliance checklists

### Database Changes

#### Migration 008: Practical Weekly Hour Limits
```sql
-- Add practical hour limit columns to contracts table
ALTER TABLE contracts ADD COLUMN weekly_hours_min_practical INTEGER;
ALTER TABLE contracts ADD COLUMN weekly_hours_max_practical INTEGER;
ALTER TABLE contracts ADD COLUMN notes_practical_caps TEXT;

-- Set default values based on contract type
UPDATE contracts SET 
  weekly_hours_min_practical = CASE 
    WHEN type = 'Minijob' THEN GREATEST(contract_hours - 2, 8)
    WHEN type = 'Student' THEN GREATEST(contract_hours - 2, 18)
    ELSE contract_hours - 4
  END,
  weekly_hours_max_practical = CASE 
    WHEN type = 'Minijob' THEN LEAST(contract_hours + 2, 12)
    WHEN type = 'Student' THEN LEAST(contract_hours + 2, 22)  
    ELSE contract_hours + 4
  END
WHERE weekly_hours_min_practical IS NULL OR weekly_hours_max_practical IS NULL;
```

**Migration Safety Notes:**
- ✅ **Backward Compatible**: Existing code gracefully falls back to contract hours when practical limits are null
- ✅ **Data Preservation**: All existing contract data maintained during migration
- ✅ **Rollback Safe**: Can be reverted by dropping added columns without data loss
- ⚠️ **Validation Required**: Ensure min ≤ max practical hours after migration

### Breaking Changes

#### ⚠️ API Changes
- **Enhanced `getEffectiveWeeklyLimits()` method signature**
  - Now returns object with `min`, `max`, and `target` properties
  - Previous single-value return is deprecated but supported
  - Update calling code to use structured return values

#### ⚠️ UI Behavioral Changes
- **Minijob swap confirmations** now required for earnings-impacting changes
- **Monitoring tab** added to main navigation (may affect custom UI modifications)
- **Practical hours fields** visible for relevant contract types only

### Security Enhancements

#### 🔒 GDPR Compliance
- **Complete privacy framework** with lawful basis documentation
- **Data subject rights procedures** with automated request handling
- **Breach notification protocols** with timeline compliance
- **Processor agreement templates** for third-party integrations

#### 🔍 Audit & Monitoring
- **Comprehensive API call logging** with timestamp and metadata tracking
- **Performance monitoring** with health status assessment
- **Business rule violation tracking** for compliance reporting
- **Public API security considerations** documented for production deployment

### Performance Improvements

#### ⚡ Schedule Generation Optimization
- **Enhanced rest-period calculation** with optimized historical data filtering
- **Improved scoring algorithm** integrating practical hour limits
- **Performance tracking** with sub-5-second generation targets for 50+ staff

### UI & Scheduling Engine Hardening (Current Unreleased Work)

#### 🗓 Holiday & Day-Type Consistency
- Unified canonical day-type resolution via `computeDayType()` + `getHolidayName()`; late-loaded holidays trigger reclassification (`reclassifyMonthDayTypes`) to keep shift sets aligned.
- Added `updateHolidayBadgesExt(year, { retype:true })` to repaint badges and retype day cells after service hydration (fixes missing October 3rd badge edge case).

#### ⚙️ Single Generation Entry Path
- All schedule creation now flows through `ScheduleUI.generateScheduleForCurrentMonth()` with an in-flight guard and legacy global bridge preserved for older bindings.
- Availability hydration enforced pre-generation when remote store is active.

#### 🛠 Recovery Workflow Refactor
- Extracted recovery gap detection and fill preview into `_collectCriticalGaps`, `_runRecoveryPreview`, `_applyRecovery` prototype methods.
- Added in-flight prevention + timing logs (`[recovery][preview]` / `[recovery][apply]`).

#### ❗ Invalid Shift Highlighting
- Cells now flag assignments whose shift key no longer applies to the recomputed day type (`invalid-shift` + `badge-error`).
- Ensures visibility when holiday/weekend status changes after initial assignment.

#### ♿ Modal Accessibility & Routing
- Focus trap, sentinels, automatic `aria-labelledby`, and backdrop/escape close standardized.
- Wrapped existing `modalManager.open/close` to ensure a11y instrumentation always applied.

#### 🪪 Observability & Diagnostics
- Phase logs added for calendar render steps (start, holidays-initial, done).
- Console instrumentation for generation duration and recovery candidate counts.
- Added `runA11yAudit()` utility (prototype) to detect missing roles / labels (not auto-run yet).

#### 🔌 Event Delegation Progress
- Toolbar, calendar day clicks, and recovery buttons now delegated at document level (reduces per-render listeners).
- Remaining per-pill assignment listeners slated for delegation in upcoming refinement.

#### 🧼 Misc Improvements
- Removed duplicate search modal close call.
- Normalized modal open/close behavior; deprecated legacy `__openModal`/`__closeModal` with warnings.

#### Planned Next (Not Yet Included)
- Delegate assignment pill & swap button events.
- Integrate busy state (aria-busy) around generation, hydration, and recovery.
- Execute and surface results of `runA11yAudit()`.
- **Memory usage optimization** for extended operational sessions

### Documentation Updates

#### 📚 Comprehensive Pilot Documentation
- **GDPR compliance documentation** (9 detailed documents)
- **Complete test protocol** with 80+ validation test cases  
- **Pilot readiness guide** with operational procedures
- **API documentation** for external integration partners
- **Migration procedures** with rollback instructions

### Configuration Changes

#### ⚙️ New Environment Variables
- `MONITORING_ENABLED` - Enable/disable monitoring dashboard (default: true)
- `API_AUDIT_LEVEL` - API call logging verbosity (default: 'standard')
- `PRACTICAL_LIMITS_ENABLED` - Enable practical hour limits feature (default: true)

#### ⚙️ Updated Configuration Options
- Academic term detection for Werkstudent exception rules
- Holiday shift premium calculation settings
- Monitoring dashboard auto-refresh intervals
- API rate limiting preparation (infrastructure-level)

### Deployment Notes

#### 🚀 Pre-Deployment Checklist
1. **Database Migration**: Apply migration 008 in staging environment first
2. **GDPR Documentation**: Review and approve all privacy documentation
3. **Staff Training**: Complete pilot readiness training for operational staff
4. **Monitoring Setup**: Verify monitoring dashboard accessibility
5. **API Testing**: Validate public API endpoints if external integrations planned

#### 📋 Post-Deployment Verification
1. **Migration Validation**: Verify practical hour limits data integrity
2. **Feature Testing**: Execute core test protocol scenarios  
3. **Monitoring Check**: Confirm dashboard displays current system status
4. **Performance Validation**: Verify schedule generation times within targets
5. **GDPR Compliance**: Confirm privacy procedures are operational

### Known Issues & Limitations

#### ⚠️ Current Limitations
- **Academic term detection** requires manual configuration for non-standard semesters
- **Holiday shift premium** calculation depends on accurate holiday calendar data
- **Monitoring dashboard** auto-refresh requires modern browser support
- **API rate limiting** should be implemented at infrastructure level for production

#### 🔄 Future Enhancements Planned
- Automated academic calendar integration
- Advanced scheduling algorithm with machine learning optimization  
- Mobile-responsive monitoring dashboard
- Advanced reporting with data visualization
- Integration with external payroll systems

### Migration Guide

#### From Previous Version

1. **Backup your database** before applying any changes
2. **Run migration 008** to add practical hour limit columns:
   ```bash
   # Apply migration
   psql -d scheduler_db -f migrations/008_practical_limits.sql
   
   # Verify migration
   psql -d scheduler_db -c "\d contracts"
   ```
3. **Update application configuration** to enable new features
4. **Train staff** on new practical hour limit functionality
5. **Review GDPR documentation** and update privacy notices as needed

#### Rollback Procedure

If rollback is necessary:
```sql
-- Remove added columns (data loss warning!)
ALTER TABLE contracts DROP COLUMN IF EXISTS weekly_hours_min_practical;
ALTER TABLE contracts DROP COLUMN IF EXISTS weekly_hours_max_practical;  
ALTER TABLE contracts DROP COLUMN IF EXISTS notes_practical_caps;
```

### Testing Requirements

#### ✅ Required Testing Before Production
- Execute complete test protocol (docs/TEST_PROTOCOL.md)
- Validate all business rule scenarios
- Perform load testing with expected user concurrency
- Verify GDPR compliance procedures
- Test monitoring dashboard under various system states

#### 📊 Success Criteria
- All test cases in test protocol passing
- Schedule generation < 5 seconds for 50+ staff
- No critical business rule violations
- Monitoring dashboard operational
- GDPR documentation approved by legal/compliance

---

## Version History

### [Previous Versions]

Previous changelog entries would appear here in a production system. This release represents the major pilot readiness milestone with comprehensive GDPR compliance, practical hour limits, and operational monitoring capabilities.

---

**Contributors:** Development Team, Business Stakeholders, Compliance Team  
**Release Manager:** [To be assigned]  
**Approval Required:** Technical Lead, Business Owner, Compliance Officer

**Version Control:**
- Branch: `main`
- Tag: `v1.0.0-pilot`
- Build: [To be generated on release]