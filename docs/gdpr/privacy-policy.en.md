# Privacy Policy - FTG Sportfabrik Smart Staff Scheduler

**Data Controller:** FTG Sportfabrik GmbH  
**Date:** September 20, 2025  
**Version:** 1.0

## 1. General Information

This privacy policy informs you about the processing of personal data in the FTG Sportfabrik Smart Staff Scheduler (hereinafter "Application"). The application serves to plan and manage work shifts in compliance with German labor laws.

## 2. Data Controller

**FTG Sportfabrik GmbH**  
[Insert address]  
[Insert email]  
[Insert phone]

**Data Protection Officer:** [Insert name and contact details if required]

## 3. Processed Data

### 3.1 Employee Data
- **Name:** Full name for shift planning and legal compliance
- **Role:** Employment contract type (Permanent, Student Worker, Mini-Job)
- **Contract Hours:** Weekly target working hours
- **Typical Workdays:** Number of regular working days per week
- **Weekend Preference:** Willingness to work weekends
- **Alternative Weekend Days:** Specific weekdays for alternative weekend arrangements

### 3.2 Availability Data
- **Availability Times:** Per employee, date and shift
- **Voluntary Shifts:** Additional availability declarations
- **Time Off:** Vacation days and sick days

### 3.3 Shift Planning Data
- **Shift Assignments:** Date, shift type, assigned employee
- **Overtime Consents:** Documented consent for weekend work (permanent employees)
- **Change History:** Log of planning modifications

### 3.4 Technical Data
- **Error Logs:** Technical error messages without personal reference
- **Audit Logs:** System activities with user attribution
- **Session Data:** Temporary login information

## 4. Legal Basis

| Purpose | Legal Basis (GDPR) | Description |
|---------|-------------------|-------------|
| Work Shift Planning | Art. 6 para. 1 lit. b | Fulfillment of employment contract obligations |
| Working Time Law Compliance | Art. 6 para. 1 lit. c | Compliance with legal obligations (ArbZG, JArbSchG) |
| Overtime Consent | Art. 6 para. 1 lit. a | Consent for weekend work |
| Audit and Compliance | Art. 6 para. 1 lit. f | Legitimate interest in proper business operations |

## 5. Data Storage and Transfer

### 5.1 Local Storage
- **Primary Storage:** Browser storage (localStorage) of the respective workplace
- **Purpose:** Offline functionality and privacy through minimization of central storage

### 5.2 Central Database (optional)
- **Provider:** Supabase (hosted in the EU)
- **Purpose:** Synchronization between multiple workplaces
- **Security:** Row Level Security (RLS), encryption in transit and at rest

### 5.3 Data Transfer
- **Encryption:** All data transfers occur via HTTPS/WSS
- **Minimization:** Only necessary data is transferred

## 6. Retention Periods

| Data Type | Retention Period | Deletion Criteria |
|-----------|------------------|------------------|
| Employee Master Data | Until 3 years after contract end | Automatic deletion |
| Availability Data | 12 months | Rolling deletion cycle |
| Shift Plans (current) | Until month end + 2 years | Tax retention requirement |
| Overtime Consents | 3 years | Labor law proof requirement |
| Audit Logs | 1 year | Compliance evidence |
| Error Logs | 30 days | Technical optimization |

## 7. Your Rights

### 7.1 Right of Access (Art. 15 GDPR)
You have the right to obtain information about the stored data concerning you.

### 7.2 Right to Rectification (Art. 16 GDPR)
You can request the correction of incorrect data.

### 7.3 Right to Erasure (Art. 17 GDPR)
You can request the deletion of your data, provided no legal retention obligations oppose this.

### 7.4 Right to Restriction of Processing (Art. 18 GDPR)
You can request the restriction of processing.

### 7.5 Right to Object (Art. 21 GDPR)
You can object to processing based on legitimate interests.

### 7.6 Right to Data Portability (Art. 20 GDPR)
You have the right to receive your data in a structured format.

### 7.7 Withdrawal of Consent
Given consents (e.g., for overtime work) can be withdrawn at any time.

**Exercise of Rights:** Contact [Data Controller contact details]

## 8. Technical and Organizational Measures

### 8.1 Data Security
- Content Security Policy (CSP) against code injection
- Encrypted data transmission (HTTPS/WSS)
- Row Level Security in database
- Regular security updates

### 8.2 Access Control
- User authentication required
- Role-based access control
- Audit logging of all access

### 8.3 Privacy by Design
- Data minimization: Only necessary data is collected
- Local storage preferred
- Automatic deletion cycles implemented

## 9. Data Protection Impact Assessment

A Data Protection Impact Assessment has been conducted. The risk is assessed as low due to:
- Minimal storage of personal data
- Strong technical protection measures
- Local data storage

## 10. Right to Complain

You have the right to lodge a complaint with a data protection supervisory authority regarding the processing of your data.

**Competent Authority:** [Insert state data protection authority]

## 11. Changes

This privacy policy may be adapted in case of changes to the application or legal requirements. The current version is available in the application.

---

**Note:** This privacy policy must be reviewed by a data protection expert before production start and adapted to the specific circumstances of FTG Sportfabrik.