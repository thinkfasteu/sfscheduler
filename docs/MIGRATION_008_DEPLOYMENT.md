# Migration 008 Deployment Instructions

**Migration:** Add Practical Weekly Hour Limits to Contracts Table  
**Version:** 008  
**Target:** Production Deployment  
**Estimated Duration:** 15-30 minutes  
**Rollback Time:** 5-10 minutes

---

## 🎯 Migration Overview

Migration 008 adds practical weekly hour limit columns to the contracts table, enabling the scheduler to use realistic operational targets alongside legal contract maximums.

### Changes Summary
- Adds `weekly_hours_min_practical` column (INTEGER)
- Adds `weekly_hours_max_practical` column (INTEGER)  
- Adds `notes_practical_caps` column (TEXT)
- Populates default values based on contract type
- Maintains full backward compatibility

---

## 📋 Pre-Migration Checklist

### Environment Verification
- [ ] **Database Access**: Confirmed access to staging and production databases
- [ ] **Backup Systems**: Automated backup systems operational
- [ ] **Monitoring**: Database monitoring active and alerts configured
- [ ] **Maintenance Window**: Scheduled maintenance window approved
- [ ] **Team Availability**: DBA and application team on standby

### Required Permissions
- [ ] **Database Admin**: Full DDL permissions on target database
- [ ] **Application User**: SELECT, INSERT, UPDATE permissions verified
- [ ] **Backup User**: Verified backup and restore capabilities
- [ ] **Monitoring User**: Access to performance metrics confirmed

### Files Required
- [ ] `migrations/008_practical_limits.sql` - Main migration script
- [ ] `migrations/008_rollback.sql` - Rollback script
- [ ] This deployment guide
- [ ] Emergency contact list

---

## 🔄 Staging Environment Deployment

### Step 1: Pre-Deployment Backup
```bash
# Create full database backup before migration
pg_dump -h staging-db.sportfabrik.de -U postgres scheduler_staging > \
  backup_pre_migration_008_$(date +%Y%m%d_%H%M%S).sql

# Verify backup file created and has reasonable size
ls -lh backup_pre_migration_008_*.sql
```

### Step 2: Apply Migration in Staging
```bash
# Connect to staging database
psql -h staging-db.sportfabrik.de -U postgres -d scheduler_staging

# Verify current table structure
\d contracts;

# Apply migration 008
\i migrations/008_practical_limits.sql

# Verify new columns added
\d contracts;

# Check sample data populated correctly
SELECT id, name, type, contract_hours, 
       weekly_hours_min_practical, weekly_hours_max_practical, 
       notes_practical_caps 
FROM contracts 
LIMIT 5;
```

### Step 3: Staging Validation Tests
```sql
-- Test 1: Verify all existing records have practical limits
SELECT COUNT(*) as total_records,
       COUNT(weekly_hours_min_practical) as with_min,
       COUNT(weekly_hours_max_practical) as with_max
FROM contracts;
-- Expected: all counts should be equal

-- Test 2: Verify practical limits are logical
SELECT id, name, type, contract_hours,
       weekly_hours_min_practical, weekly_hours_max_practical,
       CASE 
         WHEN weekly_hours_min_practical > weekly_hours_max_practical 
         THEN 'ERROR: min > max'
         WHEN weekly_hours_min_practical > contract_hours 
         THEN 'ERROR: min > contract'
         WHEN weekly_hours_max_practical < contract_hours 
         THEN 'ERROR: max < contract'
         ELSE 'OK'
       END as validation_status
FROM contracts
WHERE weekly_hours_min_practical IS NOT NULL;
-- Expected: All records should show 'OK'

-- Test 3: Verify contract type defaults
SELECT type, 
       MIN(weekly_hours_min_practical) as min_practical_range,
       MAX(weekly_hours_min_practical) as max_practical_range,
       MIN(weekly_hours_max_practical) as min_practical_max,
       MAX(weekly_hours_max_practical) as max_practical_max
FROM contracts
GROUP BY type;
-- Expected: Ranges should align with business rules
```

### Step 4: Application Testing in Staging
```bash
# Restart application to pick up schema changes
sudo systemctl restart scheduler-app-staging

# Test application functionality
curl -s http://staging.scheduler.sportfabrik.de/health | jq '.'

# Test practical limits integration
curl -s http://staging.scheduler.sportfabrik.de/api/staff | \
  jq '.[] | {id: .id, name: .name, practicalLimits: .practicalLimits}'
```

### Step 5: Staging Rollback Test
```sql
-- Test rollback procedure (DO NOT RUN IN PRODUCTION)
\i migrations/008_rollback.sql

-- Verify columns removed
\d contracts;

-- Re-apply migration for continued testing
\i migrations/008_practical_limits.sql
```

---

## 🚀 Production Environment Deployment

### Step 1: Final Pre-Production Checklist
- [ ] **Staging Tests Passed**: All validation tests successful
- [ ] **Application Tests Passed**: Staging environment fully functional
- [ ] **Rollback Tested**: Rollback procedure verified in staging
- [ ] **Maintenance Window**: Production maintenance window active
- [ ] **Team Ready**: All team members available and briefed

### Step 2: Production Backup
```bash
# Create production backup with timestamp
BACKUP_FILE="backup_pre_migration_008_prod_$(date +%Y%m%d_%H%M%S).sql"

pg_dump -h prod-db.sportfabrik.de -U postgres scheduler_production > $BACKUP_FILE

# Verify backup integrity
echo "Backup file size: $(du -h $BACKUP_FILE)"
echo "Backup record count: $(grep -c 'INSERT INTO' $BACKUP_FILE)"

# Store backup in secure location
aws s3 cp $BACKUP_FILE s3://sportfabrik-db-backups/migration-008/
```

### Step 3: Production Migration Execution
```bash
# Record start time
echo "Migration 008 started at: $(date)"

# Connect to production database
psql -h prod-db.sportfabrik.de -U postgres -d scheduler_production

# Verify current state
SELECT COUNT(*) as current_contracts FROM contracts;

# Apply migration with timing
\timing on
\i migrations/008_practical_limits.sql
\timing off

# Verify migration completed successfully
\d contracts;
```

### Step 4: Production Validation
```sql
-- Critical validation queries (must all pass)

-- 1. Data integrity check
SELECT 
  COUNT(*) as total_records,
  COUNT(weekly_hours_min_practical) as records_with_min,
  COUNT(weekly_hours_max_practical) as records_with_max,
  COUNT(CASE WHEN weekly_hours_min_practical > weekly_hours_max_practical 
             THEN 1 END) as invalid_ranges
FROM contracts;
-- Expected: total_records = records_with_min = records_with_max, invalid_ranges = 0

-- 2. Business rule compliance
SELECT type, COUNT(*) as count,
       AVG(weekly_hours_min_practical) as avg_min,
       AVG(weekly_hours_max_practical) as avg_max
FROM contracts 
GROUP BY type;
-- Expected: Reasonable averages per contract type

-- 3. No null values in critical fields
SELECT COUNT(*) as records_missing_practical_limits
FROM contracts 
WHERE weekly_hours_min_practical IS NULL 
   OR weekly_hours_max_practical IS NULL;
-- Expected: 0
```

### Step 5: Application Restart and Testing
```bash
# Restart production application
sudo systemctl restart scheduler-app-production

# Wait for application startup
sleep 30

# Health check
curl -f http://scheduler.sportfabrik.de/health || echo "Health check failed!"

# Test API endpoints
curl -s http://scheduler.sportfabrik.de/api/health | jq '.status'

# Test practical limits functionality
curl -s -H "Authorization: Bearer $API_TOKEN" \
  http://scheduler.sportfabrik.de/api/staff/1 | \
  jq '.practicalLimits'
```

### Step 6: Monitoring Verification
```bash
# Check application logs for errors
tail -f /var/log/scheduler/application.log | grep -i error

# Monitor database performance
psql -h prod-db.sportfabrik.de -U postgres -d scheduler_production -c "
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
WHERE query LIKE '%contracts%' 
ORDER BY total_time DESC 
LIMIT 10;"

# Verify monitoring dashboard shows healthy status
curl -s http://scheduler.sportfabrik.de/monitoring/health
```

---

## ⚠️ Rollback Procedures

### When to Rollback
Execute rollback immediately if:
- Migration fails to complete successfully
- Data validation checks fail
- Application fails to start after migration
- Critical functionality is broken
- Performance degradation exceeds 50%

### Emergency Rollback Steps

#### Option 1: Database Rollback (Fastest)
```bash
# 1. Stop application immediately
sudo systemctl stop scheduler-app-production

# 2. Execute rollback script
psql -h prod-db.sportfabrik.de -U postgres -d scheduler_production \
  -c "\i migrations/008_rollback.sql"

# 3. Verify columns removed
psql -h prod-db.sportfabrik.de -U postgres -d scheduler_production \
  -c "\d contracts;"

# 4. Restart application
sudo systemctl start scheduler-app-production

# 5. Verify health
curl -f http://scheduler.sportfabrik.de/health
```

#### Option 2: Full Database Restore (If rollback script fails)
```bash
# 1. Stop application
sudo systemctl stop scheduler-app-production

# 2. Drop current database (DESTRUCTIVE)
psql -h prod-db.sportfabrik.de -U postgres -c "
DROP DATABASE scheduler_production;
CREATE DATABASE scheduler_production;"

# 3. Restore from backup
psql -h prod-db.sportfabrik.de -U postgres scheduler_production < $BACKUP_FILE

# 4. Verify restore
psql -h prod-db.sportfabrik.de -U postgres scheduler_production -c "
SELECT COUNT(*) FROM contracts;"

# 5. Restart application
sudo systemctl start scheduler-app-production
```

### Post-Rollback Actions
- [ ] **Verify Application**: All functionality working as before migration
- [ ] **Notify Stakeholders**: Inform team of rollback and investigation plan
- [ ] **Document Issues**: Record what went wrong for future resolution
- [ ] **Plan Re-attempt**: Schedule investigation and corrected migration

---

## 📊 Migration Timeline

### Staging Environment (1-2 days before production)
- **Day -2**: Apply migration in staging
- **Day -1**: Complete staging validation and rollback testing
- **Day 0**: Production deployment (if staging tests pass)

### Production Deployment Timeline
```
Time 0:00 - Maintenance window begins
Time 0:05 - Database backup completed
Time 0:10 - Migration script executed
Time 0:15 - Validation tests completed
Time 0:20 - Application restarted
Time 0:25 - Health checks passed
Time 0:30 - Maintenance window ends (if successful)

Rollback Decision Point: Time 0:20
If any issues detected, execute rollback immediately
```

---

## 📞 Emergency Contacts

### Migration Team
**Database Administrator:**  
Name: [DBA Name]  
Phone: [24/7 Contact]  
Email: dba@sportfabrik.de

**Application Lead:**  
Name: [Lead Developer]  
Phone: [Direct Line]  
Email: dev-lead@sportfabrik.de

**Operations Manager:**  
Name: [Ops Manager]  
Phone: [Direct Line]  
Email: operations@sportfabrik.de

### Escalation Contacts
**IT Manager:**  
Phone: [Emergency Line]  
Authority: Migration abort decision

**General Manager:**  
Phone: [Executive Emergency]  
Authority: Business impact decisions

---

## ✅ Post-Migration Validation Checklist

### Immediate Validation (Within 30 minutes)
- [ ] **Database Schema**: All new columns present and populated
- [ ] **Data Integrity**: No orphaned or invalid data
- [ ] **Application Health**: All endpoints responding normally
- [ ] **Core Functionality**: Schedule generation working
- [ ] **Performance**: Response times within normal ranges

### Extended Validation (Within 24 hours)
- [ ] **User Acceptance**: Staff can access and use new features
- [ ] **Business Logic**: Practical limits properly enforced in scheduling
- [ ] **Reporting**: Reports show both contract and practical hours
- [ ] **Monitoring**: Dashboard displays practical limit metrics
- [ ] **API Integration**: External systems can access new fields

### Week 1 Monitoring
- [ ] **Performance Trends**: No degradation in database performance
- [ ] **Error Rates**: No increase in application errors
- [ ] **User Feedback**: Positive reception of practical limits feature
- [ ] **Data Quality**: Practical limits being used effectively

---

## 📝 Migration Sign-off

### Technical Validation
**Database Administrator:**  
Name: _________________  
Date: _________  
Signature: _________________  
Status: [ ] SUCCESSFUL [ ] ROLLED BACK [ ] ISSUES (see notes)

**Application Developer:**  
Name: _________________  
Date: _________  
Signature: _________________  
Status: [ ] SUCCESSFUL [ ] ROLLED BACK [ ] ISSUES (see notes)

### Operations Validation
**Operations Manager:**  
Name: _________________  
Date: _________  
Signature: _________________  
Status: [ ] SUCCESSFUL [ ] ROLLED BACK [ ] ISSUES (see notes)

### Final Approval
**IT Manager:**  
Name: _________________  
Date: _________  
Signature: _________________  
Status: [ ] MIGRATION COMPLETE [ ] ROLLBACK COMPLETE [ ] INVESTIGATION REQUIRED

---

**Migration Notes:**
```
[Add any specific notes about the migration execution, issues encountered, 
or recommendations for future migrations]
```

**Document Version:** 1.0  
**Last Updated:** September 2025  
**Next Review:** Post-pilot evaluation