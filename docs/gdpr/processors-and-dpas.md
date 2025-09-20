# Processors and Data Processing Agreements (DPAs)
## FTG Sportfabrik Smart Staff Scheduler

**Datum:** 20. September 2025  
**Version:** 1.0  
**Verantwortlicher:** FTG Sportfabrik GmbH

---

## 1. Übersicht

Diese Dokumentation erfasst alle Auftragsverarbeiter (Processors) und deren Datenschutz-Vereinbarungen für das FTG Sportfabrik Smart Staff Scheduler System.

**Rechtsgrundlage:** DSGVO Art. 28 (Auftragsverarbeiter)  
**Zweck:** Sicherstellung rechtmäßiger Datenverarbeitung durch Dritte

---

## 2. Aktuelle Auftragsverarbeiter

### 2.1 Supabase Inc. (Database-as-a-Service)

| Detail | Information |
|--------|-------------|
| **Service** | Backend-Datenbank, Authentifizierung, Real-time-Sync |
| **Datenverarbeitung** | Optionale zentrale Speicherung aller Scheduler-Daten |
| **Rechtsform** | Supabase Inc., US-Corporation |
| **EU-Niederlassung** | Supabase European Operations (Irland) |
| **Hosting-Standort** | EU (Frankfurt, Deutschland) |
| **Datenkategorien** | Mitarbeiterdaten, Schichtpläne, Verfügbarkeiten, Audit-Logs |
| **Betroffene Personen** | 15-20 FTG Sportfabrik Mitarbeiter |
| **Verarbeitungszweck** | Multi-User-Synchronisation, Backup, Collaborative Planning |

#### DPA-Status: ✅ **VERFÜGBAR**
- **Standard-DPA:** Supabase EU Data Processing Agreement v2.1
- **URL:** https://supabase.com/docs/company/dpa
- **Unterzeichnung:** ⚠️ **AUSSTEHEND** (vor Produktionsstart erforderlich)
- **SCCs:** Standard Contractual Clauses 2021 eingebunden
- **Adequacy Decision:** EU-Hosting, keine Drittlandübermittlung

#### Technische und organisatorische Maßnahmen (TOMs):
```
🔒 VERSCHLÜSSELUNG:
• TLS 1.3 für Datenübertragung
• AES-256 für Daten at Rest
• Key-Management via AWS KMS

🛡️ ZUGRIFFSKONTROLLE:  
• Row Level Security (RLS) implementiert
• Benutzerauthentifizierung über JWT
• Granulare Berechtigung s-Policies

📊 MONITORING:
• Audit-Logs für alle Datenbankzugriffe
• Real-time-Intrusion-Detection  
• SOC 2 Type 2 zertifiziert

🏢 COMPLIANCE:
• GDPR-compliant (EU-Operations)
• ISO 27001 zertifiziert
• Regular Penetration Testing
```

#### Sub-Processor:
| Anbieter | Service | Standort | Zweck |
|----------|---------|----------|--------|
| **Amazon Web Services** | Cloud-Infrastructure | EU-West-1 (Frankfurt) | Server-Hosting |
| **Fly.io** | Edge Network | Europa | CDN, Load Balancing |

---

### 2.2 Cloudflare Inc. (Content Delivery Network)

| Detail | Information |
|--------|-------------|
| **Service** | CDN für jsPDF-Library (PDF-Generierung) |
| **Datenverarbeitung** | Download von JavaScript-Bibliotheken |
| **Rechtsform** | Cloudflare Inc., US-Corporation |
| **EU-Niederlassung** | Cloudflare Ltd. (UK/EU-Operationen) |
| **Hosting-Standort** | Global (EU-Edge-Server verfügbar) |
| **Datenkategorien** | IP-Adressen, Browser-Metadaten (temporär) |
| **Betroffene Personen** | Alle Nutzer der Scheduler-Anwendung |
| **Verarbeitungszweck** | Bereitstellung von PDF-Generierungs-Bibliothek |

#### DPA-Status: ✅ **VERFÜGBAR**
- **Standard-DPA:** Cloudflare Data Processing Agreement
- **URL:** https://www.cloudflare.com/cloudflare-customer-dpa/
- **Unterzeichnung:** ⚠️ **AUSSTEHEND** (vor Produktionsstart empfohlen)
- **SCCs:** EU-UK TCA + SCCs 2021
- **Adequacy Decision:** UK Adequacy Decision vorhanden

#### Minimaler Datenumfang:
- ✅ **Keine personenbezogenen Daten** aus der Scheduler-Anwendung übertragen
- ✅ Nur **Standard-Web-Requests** für JavaScript-Bibliotheken
- ✅ **Keine Cookies** oder Tracking von Cloudflare verwendet
- ⚠️ **IP-Adressen** werden temporär für CDN-Routing verarbeitet

---

### 2.3 GitHub Inc. (Static Hosting)

| Detail | Information |
|--------|-------------|
| **Service** | GitHub Pages (Static Website Hosting) |
| **Datenverarbeitung** | Hosting der Web-Anwendung (Frontend only) |
| **Rechtsform** | GitHub Inc. (Microsoft Corporation) |
| **EU-Niederlassung** | Microsoft Ireland Operations Ltd. |
| **Hosting-Standort** | Global (EU-Edge-Server verfügbar) |
| **Datenkategorien** | IP-Adressen, HTTP-Request-Logs (temporär) |
| **Betroffene Personen** | Alle Nutzer der Scheduler-Anwendung |
| **Verarbeitungszweck** | Bereitstellung der Web-Anwendung |

#### DPA-Status: ✅ **VERFÜGBAR**
- **Standard-DPA:** Microsoft Products and Services DPA
- **URL:** https://www.microsoft.com/licensing/docs/view/Microsoft-Products-and-Services-Data-Protection-Addendum-DPA
- **Unterzeichnung:** ⚠️ **AUSSTEHEND** (vor Produktionsstart erforderlich)
- **SCCs:** Microsoft EU-US Data Transfers Framework
- **Adequacy Decision:** EU-US Data Privacy Framework (2023)

#### Minimaler Datenumfang:
- ✅ **Keine personenbezogenen Daten** der Scheduler-Anwendung gespeichert
- ✅ Nur **statische HTML/CSS/JS-Dateien** gehostet
- ✅ **Keine Server-side-Verarbeitung** von Benutzerdaten
- ⚠️ **Access-Logs** mit IP-Adressen (automatisch nach 90 Tagen gelöscht)

---

## 3. Geplante Auftragsverarbeiter (Roadmap)

### 3.1 E-Mail-Benachrichtigungen (zukünftig)

**Kandidaten:**
- **SendGrid** (Twilio) - EU-gehostet
- **Amazon SES** - EU-West-1
- **Microsoft Graph API** (Office 365) - EU-Datenresidenz

**Datenverarbeitung:** Versand von Schichtplan-Updates, Erinnerungen  
**Status:** Planung für Version 2.0  
**DPA-Erfordernis:** Ja, vor Implementation

### 3.2 Analytics und Monitoring (optional)

**Kandidaten:**
- **Plausible Analytics** - EU-gehostet, GDPR-compliant
- **Umami Analytics** - Self-hosted Option
- **Mixpanel** - EU-Datenresidenz verfügbar

**Datenverarbeitung:** Anonymisierte Nutzungsstatistiken  
**Status:** Evaluation Phase  
**DPA-Erfordernis:** Abhängig von gewählter Lösung

### 3.3 Backup und Disaster Recovery (zukünftig)

**Kandidaten:**
- **Hetzner Storage Box** - Deutschland
- **OVHcloud Backup** - Frankreich  
- **AWS S3** - EU-West-1 (Frankfurt)

**Datenverarbeitung:** Verschlüsselte Backup-Speicherung  
**Status:** Technische Evaluierung  
**DPA-Erfordernis:** Ja, Standard-DPAs verfügbar

---

## 4. DPA-Management-Verfahren

### 4.1 Vertragsabschluss-Checkliste

#### Vor Vertragsunterzeichnung:
- [ ] **Legal Review** - Rechtsprüfung durch Datenschutzbeauftragten
- [ ] **Technical Assessment** - IT-Sicherheitsbewertung
- [ ] **Compliance Check** - GDPR-Konformität bestätigen
- [ ] **Sub-Processor Review** - Alle Unterauftragsverarbeiter bewerten

#### Vertragsinhalt prüfen:
- [ ] **Zweckbindung** - Datenverarbeitung nur für vereinbarte Zwecke
- [ ] **Weisungsgebundenheit** - Verarbeitung nur auf Weisung
- [ ] **Vertraulichkeit** - Verpflichtung zur Geheimhaltung
- [ ] **Sicherheitsmaßnahmen** - Angemessene TOMs implementiert
- [ ] **Sub-Processing** - Klare Regelungen für Unterauftragsverarbeiter
- [ ] **Unterstützungspflichten** - Hilfe bei Betroffenenrechten und Compliance
- [ ] **Audit-Rechte** - Überprüfungsmöglichkeiten vereinbart
- [ ] **Breach Notification** - Schnelle Meldung von Datenpannen
- [ ] **Rückgabe/Löschung** - Verfahren nach Vertragsende definiert

### 4.2 Laufende Überwachung

#### Quartalsweise Reviews:
- 📊 **Service-Performance** - SLA-Einhaltung prüfen
- 🔒 **Security-Updates** - Aktuelle Zertifizierungen validieren
- 📋 **Compliance-Status** - Änderungen bei Zertifizierungen/Standorten
- 📞 **Communication** - Regelmäßiger Austausch mit Anbietern

#### Jährliche Audits:
- 🔍 **On-site/Remote Audits** - Direkte Überprüfung (soweit möglich)
- 📋 **Questionnaire-based Assessment** - Standardisierte Fragebögen
- 📊 **Third-party Certifications** - SOC 2, ISO 27001, etc. bewerten
- 🔄 **Contract Review** - Vertragsanpassungen bei Änderungen

### 4.3 Incident Management mit Auftragsverarbeitern

#### Meldepflichten:
- **Frist:** 24 Stunden nach Kenntniserlangung durch Auftragsverarbeiter
- **Kanal:** E-Mail + Telefon an Incident Commander
- **Inhalt:** Preliminary Assessment + geplante Maßnahmen

#### Koordination:
- **Lead:** FTG Sportfabrik Incident Commander
- **Support:** Auftragsverarbeiter Technical Lead
- **Communication:** Joint Communication für Betroffene (falls erforderlich)

---

## 5. Rechtliche Bewertungen

### 5.1 Angemessenheitsbeschlüsse und SCCs

| Land/Region | Angemessenheitsbeschluss | Alternative Garantien |
|-------------|-------------------------|----------------------|
| **EU/EWR** | ✅ Kein DPA erforderlich | - |
| **Vereinigtes Königreich** | ✅ UK Adequacy Decision | - |
| **USA** | ✅ EU-US Data Privacy Framework (seit 2023) | SCCs 2021 als Fallback |
| **Schweiz** | ✅ Swiss-EU Adequacy Decision | - |
| **Kanada** | ❌ Kein Beschluss | SCCs 2021 erforderlich |

### 5.2 Risikobewertung Drittlandübermittlungen

#### Aktuelle Übermittlungen:
- **Supabase:** ❌ **KEINE** - EU-Hosting (Frankfurt)
- **Cloudflare:** ⚠️ **MINIMAL** - Nur IP-Routing, UK-adequacy
- **GitHub Pages:** ⚠️ **MINIMAL** - Nur Static Hosting, US Privacy Framework

#### Schutzmaßnahmen:
- ✅ **Verschlüsselung** - End-to-End bei sensitiven Daten
- ✅ **Pseudonymisierung** - Wo technisch möglich implementiert  
- ✅ **Access Controls** - Granulare Zugriffsbeschränkungen
- ✅ **Monitoring** - Comprehensive Audit-Trails

### 5.3 Compliance-Matrix

| Auftragsverarbeiter | GDPR | SCCs | ISO 27001 | SOC 2 | Standort |
|-------------------|------|------|-----------|-------|----------|
| **Supabase** | ✅ | ✅ | ✅ | ✅ | 🇪🇺 EU |
| **Cloudflare** | ✅ | ✅ | ✅ | ✅ | 🇬🇧 UK |
| **GitHub Pages** | ✅ | ✅ | ✅ | ✅ | 🇺🇸 US (DPF) |

---

## 6. Vertragsmanagement

### 6.1 DPA-Tracker

| Auftragsverarbeiter | DPA-Status | Unterzeichnet | Gültig bis | Nächste Review |
|-------------------|------------|---------------|------------|----------------|
| **Supabase** | ⚠️ Ausstehend | - | - | Vor Go-Live |
| **Cloudflare** | ⚠️ Ausstehend | - | - | Vor Go-Live |
| **GitHub** | ⚠️ Ausstehend | - | - | Vor Go-Live |

### 6.2 Dokumenten-Repository

**Speicherort:** `/docs/contracts/dpas/`  
**Zugriff:** Datenschutzbeauftragte, Geschäftsführung, Rechtsabteilung

#### Ordnerstruktur:
```
/docs/contracts/dpas/
├── executed/           # Unterzeichnete Verträge
│   ├── supabase-dpa-2025.pdf
│   ├── cloudflare-dpa-2025.pdf
│   └── github-dpa-2025.pdf
├── templates/          # Standard-DPA-Vorlagen
├── reviews/           # Jährliche Review-Reports
└── correspondence/    # E-Mail-Kommunikation mit Anbietern
```

### 6.3 Renewal-Management

**Erinnerungen:** 90 Tage vor Vertragsablauf  
**Verantwortlich:** Datenschutzbeauftragte  
**Eskalation:** 30 Tage vor Ablauf an Geschäftsführung

---

## 7. Emergency Procedures

### 7.1 DPA-Verletzung durch Auftragsverarbeiter

#### Sofortmaßnahmen:
1. **Service-Unterbrechung** - Stopp der Datenübermittlung
2. **Schadensbegrenzung** - Bereits übertragene Daten bewerten
3. **Legal Assessment** - Rechtliche Optionen prüfen
4. **Alternative Solutions** - Backup-Auftragsverarbeiter aktivieren

#### Rechtliche Optionen:
- **Vertragsstrafen** - Durchsetzung von Penalty-Klauseln
- **Sofortige Kündigung** - Bei schwerwiegenden Verstößen
- **Schadensersatz** - Bei nachweisbaren Schäden
- **Behördenmeldung** - DSGVO-Violation-Report

### 7.2 Auftragsverarbeiter-Insolvenz

#### Vorbereitung:
- ✅ **Data Portability** - Exportmöglichkeiten bei allen Anbietern
- ✅ **Backup-Anbieter** - Alternative DPAs vorbereitet
- ✅ **Migration-Plan** - Technische Wechselprozesse dokumentiert

#### Akutmaßnahmen:
1. **Daten-Export** - Sofortige Sicherung aller Daten
2. **Access-Revocation** - Zugriffsrechte entziehen
3. **Service-Migration** - Wechsel zu Backup-Anbieter
4. **Legal Protection** - Löschungsnachweis einfordern

---

## 8. Action Items vor Produktionsstart

### 8.1 Kritische Aufgaben (Go-Live-Blocker)

- [ ] **Supabase DPA unterzeichnen** - Erforderlich für zentrale DB-Nutzung
- [ ] **GitHub DPA unterzeichnen** - Erforderlich für Hosting
- [ ] **Sub-Processor-Liste aktualisieren** - Alle Anbieter dokumentieren
- [ ] **Incident-Kontakte etablieren** - Notfall-Telefonnummern von allen Anbietern

### 8.2 Empfohlene Aufgaben (Nice-to-have)

- [ ] **Cloudflare DPA unterzeichnen** - Für vollständige Compliance
- [ ] **Backup-DPAs vorbereiten** - Alternative Anbieter für Notfall
- [ ] **Auto-Renewal-Klauseln verhandeln** - Reduziert Verwaltungsaufwand
- [ ] **Monitoring-Integration** - Compliance-Status in Dashboard

---

## 9. Kosten-Überblick

| Auftragsverarbeiter | Grundkosten | DPA-Gebühren | Setup-Kosten | Jährliche Kosten |
|-------------------|-------------|--------------|--------------|-----------------|
| **Supabase** | $0-25/Monat | Kostenlos | $0 | $0-300 |
| **Cloudflare** | Kostenlos (CDN) | Kostenlos | $0 | $0 |
| **GitHub Pages** | Kostenlos | Kostenlos | $0 | $0 |
| **Legal Review** | - | - | $1,500 | $500 |
| **DPA Management** | - | - | - | $2,000 |

**Gesamt-TCO Jahr 1:** Ca. $2,000-2,800 (hauptsächlich Legal)

---

## 10. Kontakte und Ansprechpartner

### 10.1 Interne Kontakte

| Rolle | Name | E-Mail | Telefon |
|-------|------|--------|---------|
| **Datenschutzbeauftragte/r** | [Name] | [E-Mail] | [Telefon] |
| **IT-Verantwortliche/r** | [Name] | [E-Mail] | [Telefon] |
| **Rechtsabteilung** | [Name] | [E-Mail] | [Telefon] |
| **Einkauf/Beschaffung** | [Name] | [E-Mail] | [Telefon] |

### 10.2 Externe Kontakte (DPA-Verhandlung)

| Anbieter | Kontakt-Art | E-Mail | Telefon |
|----------|-------------|--------|---------|
| **Supabase** | DPA-Team | privacy@supabase.com | - |
| **Cloudflare** | Privacy Team | privacyquestions@cloudflare.com | - |
| **GitHub** | Privacy Office | privacy@github.com | - |

---

**Status:** ⚠️ **ENTWURF** - DPA-Unterzeichnungen vor Produktionsstart erforderlich

**Nächste Schritte:**
1. DPA-Verhandlungen mit allen Anbietern initiieren
2. Legal Review der Standard-DPAs durchführen
3. Unterzeichnung und Dokumentation abschließen
4. Compliance-Monitoring implementieren

**Version 1.0 - Letzte Aktualisierung: 20. September 2025**