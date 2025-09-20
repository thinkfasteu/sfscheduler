# Backup & Restore Procedures
## FTG Sportfabrik Smart Staff Scheduler

**Document Version:** 1.0  
**Last Updated:** September 20, 2025  
**Approved By:** [IT Manager], [Operations Manager]

---

## 🎯 Overview / Überblick

This document provides comprehensive backup and restore procedures for the FTG Sportfabrik Smart Staff Scheduler to ensure business continuity and data protection during the pilot phase and beyond.

### Recovery Objectives
- **Recovery Time Objective (RTO):** 4 hours
- **Recovery Point Objective (RPO):** 24 hours
- **Business Continuity:** Manual scheduling fallback available

---

## 📋 Daily Backup Procedures / Tägliche Backup-Verfahren

### Automated Browser-Based Backup
The system automatically creates local browser backups every 24 hours.

#### Verification Steps:
```javascript
// Check last backup timestamp in browser console
console.log('Last backup:', localStorage.getItem('lastBackupTimestamp'));

// Verify backup data size
const backupData = localStorage.getItem('scheduleBackup');
console.log('Backup size:', backupData ? backupData.length : 'No backup found');
```

### Manual Export Backup
**Frequency:** Weekly or before major changes

1. **Access backup interface:**
   - Navigate to Settings → Export Data
   - Select "Complete System Backup"
   - Include: Staff data, schedules, configurations, audit logs

2. **Export process:**
   ```
   File Format: JSON
   Encryption: AES-256 (automatic)
   Storage: Secure shared drive /Backups/YYYY-MM-DD/
   Naming: sf_scheduler_backup_YYYY-MM-DD_HHMM.json
   ```

3. **Verification:**
   - File size > 50KB (typical for active system)
   - JSON structure validates
   - Contains current week's schedule data

---

## 🔄 Restore Procedures / Wiederherstellungsverfahren

### Scenario 1: Browser Data Loss
**Cause:** Browser cache cleared, localStorage corrupted

**Steps:**
1. **Access restore interface:**
   - Open scheduler application
   - Navigate to Settings → Import Data
   - Select "Restore from Backup"

2. **Import process:**
   ```
   1. Select backup file (sf_scheduler_backup_*.json)
   2. Verify backup timestamp and data preview
   3. Choose restore scope:
      □ Staff data only
      □ Schedules only  
      □ Complete restore (recommended)
   4. Confirm restore operation
   ```

3. **Post-restore validation:**
   - Verify current staff list appears correctly
   - Check latest schedule displays properly
   - Test basic operations (create shift, assign staff)
   - Confirm audit log continuity

### Scenario 2: Application Corruption
**Cause:** Code deployment issues, system errors

**Steps:**
1. **Roll back to previous version:**
   ```bash
   # Revert to last known good deployment
   git checkout [previous-stable-commit]
   npm run build
   ```

2. **Restore from backup:**
   - Follow Scenario 1 procedures
   - Import most recent validated backup
   - Verify system functionality

3. **Manual data entry (if needed):**
   - Use backup spreadsheet templates from shared drive
   - Enter critical schedules manually
   - Import into system once restored

### Scenario 3: Complete System Failure
**Cause:** Infrastructure outage, major corruption

**Emergency Procedures:**

1. **Immediate response (0-1 hours):**
   - Activate manual scheduling procedures
   - Access backup spreadsheet templates
   - Notify staff of temporary manual process

2. **Recovery process (1-4 hours):**
   - Rebuild system infrastructure
   - Restore from most recent backup
   - Validate data integrity
   - Test all critical functions

3. **Return to service:**
   - Gradual migration from manual to automated
   - Data reconciliation and audit
   - Staff notification of system restoration

---

## 📊 Supabase Database Backup (Future)

### Automated Database Backup
**Note:** For production deployment with Supabase integration

```sql
-- Daily automated backup
SELECT backup_database('sf_scheduler_' || to_char(now(), 'YYYY_MM_DD'));

-- Retention policy: 30 days
DELETE FROM backups WHERE created_at < now() - interval '30 days';
```

### Database Restore Process
```sql
-- Restore from specific backup
SELECT restore_database('sf_scheduler_2025_09_20');

-- Verify data integrity
SELECT COUNT(*) FROM staff;
SELECT COUNT(*) FROM schedules WHERE week_start >= current_date - interval '7 days';
```

---

## 🚨 Emergency Contacts / Notfallkontakte

### Technical Team
| Role | Primary | Backup | Phone | Email |
|------|---------|--------|-------|-------|
| **System Administrator** | [Name] | [Backup Name] | [Phone] | [Email] |
| **Database Admin** | [Name] | [Backup Name] | [Phone] | [Email] |
| **Application Support** | [Name] | [Backup Name] | [Phone] | [Email] |

### Business Team
| Role | Primary | Backup | Phone | Email |
|------|---------|--------|-------|-------|
| **Operations Manager** | [Name] | [Backup Name] | [Phone] | [Email] |
| **Shift Supervisor** | [Name] | [Backup Name] | [Phone] | [Email] |
| **Reception Manager** | [Name] | [Backup Name] | [Phone] | [Email] |

---

## 📝 Testing & Validation / Tests und Validierung

### Monthly Backup Testing
- [ ] **Backup Creation Test** - Generate full backup successfully
- [ ] **Restore Test** - Restore backup to test environment
- [ ] **Data Integrity** - Verify all data restored correctly
- [ ] **Performance Test** - Confirm system operates normally
- [ ] **Documentation Update** - Update procedures if needed

### Quarterly Disaster Recovery Drill
- [ ] **Complete System Rebuild** - Simulate total system failure
- [ ] **Recovery Time Measurement** - Track actual vs. target RTO
- [ ] **Business Continuity** - Test manual scheduling procedures
- [ ] **Communication Test** - Verify emergency contact procedures
- [ ] **Lessons Learned** - Document improvements needed

---

## 📖 Related Documents / Verwandte Dokumente

- `/docs/MIGRATION_008_DEPLOYMENT.md` - Migration rollback procedures
- `/docs/gdpr/incident-response-plan.md` - Data breach response
- `/docs/PILOT_READINESS_GUIDE.md` - Manual scheduling fallback
- `/docs/ENV.md` - Environment configuration

---

**Approval Required:**

- [ ] **IT Manager** - Technical procedures validated
- [ ] **Operations Manager** - Business continuity confirmed  
- [ ] **Data Protection Officer** - GDPR compliance verified
- [ ] **Legal Counsel** - Regulatory requirements met

**Next Review Date:** January 20, 2026