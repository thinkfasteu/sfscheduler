# Incident Response Plan - Data Protection
## FTG Sportfabrik Smart Staff Scheduler

**Gültig ab:** 20. September 2025  
**Version:** 1.0  
**Verantwortlich:** FTG Sportfabrik GmbH

---

## 1. Übersicht und Zielsetzung

### 1.1 Zweck
Dieser Plan definiert Verfahren zur schnellen und ordnungsgemäßen Reaktion auf Datenschutzvorfälle im FTG Sportfabrik Smart Staff Scheduler, um:

- ✅ Schäden für Betroffene zu minimieren
- ⚖️ Gesetzliche Meldepflichten einzuhalten (DSGVO Art. 33/34)
- 🛡️ Weitere Datenschutzverletzungen zu verhindern
- 📋 Transparenz und Vertrauen zu erhalten

### 1.2 Anwendungsbereich
**Abgedeckte Systeme:**
- FTG Sportfabrik Smart Staff Scheduler (Web-App)
- Lokale Datenspeicherung (localStorage)
- Optionale Supabase-Datenbank
- Backup- und Export-Systeme

**Incident-Typen:**
- Datenpannen (Data Breaches)
- Unbefugter Zugriff
- Datenverlust oder -beschädigung
- Systemkompromittierung
- Menschliche Fehler mit Datenschutzbezug

---

## 2. Rollen und Verantwortlichkeiten

### 2.1 Incident Response Team

| Rolle | Person | Primäre Aufgaben | Kontakt (24/7) |
|-------|--------|------------------|----------------|
| **Incident Commander** | [Datenschutzbeauftragte/r] | Gesamtkoordination, Meldungen, Kommunikation | [Telefon] [E-Mail] |
| **IT-Coordinator** | [IT-Verantwortliche/r] | Technische Sofortmaßnahmen, Systemsicherung | [Telefon] [E-Mail] |
| **Legal Officer** | [Rechtsberater] | Rechtsbewertung, Behördenkontakt | [Telefon] [E-Mail] |
| **Communications Lead** | [PR-Verantwortliche/r] | Interne/externe Kommunikation | [Telefon] [E-Mail] |
| **Business Continuity** | [Geschäftsführung] | Strategische Entscheidungen, Ressourcen | [Telefon] [E-Mail] |

### 2.2 Eskalationsmatrix

```
┌─ Stufe 1: Lokal ─────────────────────────────────────┐
│ Einzelner Mitarbeiter bemerkt Anomalie               │
│ → Sofortige Meldung an IT-Coordinator                │
│ → Information an Incident Commander                  │
└──────────────────────────────────────────────────────┘
                        │
                        ▼
┌─ Stufe 2: Operational ───────────────────────────────┐
│ IT-Coordinator bestätigt Datenschutzvorfall         │
│ → Aktivierung des Incident Response Teams           │
│ → Sofortmaßnahmen-Checkliste abarbeiten            │
└──────────────────────────────────────────────────────┘
                        │
                        ▼
┌─ Stufe 3: Management ────────────────────────────────┐
│ Incident Commander bewertet Meldepflicht            │
│ → Einschaltung Legal Officer                        │
│ → Information der Geschäftsführung                  │
└──────────────────────────────────────────────────────┘
                        │
                        ▼
┌─ Stufe 4: Behörden ──────────────────────────────────┐
│ Meldepflicht nach Art. 33/34 DSGVO aktiviert       │
│ → Meldung an Aufsichtsbehörde (72h)                │
│ → Benachrichtigung der Betroffenen                  │
└──────────────────────────────────────────────────────┘
```

---

## 3. Incident-Klassifizierung

### 3.1 Schweregrad-Matrix

| Level | Bezeichnung | Kriterien | Beispiele | Eskalation |
|-------|-------------|-----------|-----------|------------|
| **🟢 Level 1** | **GERING** | <5 Personen betroffen, keine sensiblen Daten | Versehentliche Anzeige fremder Verfügbarkeiten | IT-Coordinator |
| **🟡 Level 2** | **MITTEL** | 5-20 Personen, begrenzte Auswirkungen | Unbefugter Zugriff auf Schichtpläne | Incident Commander |
| **🟠 Level 3** | **HOCH** | >20 Personen, oder sensitive Compliance-Daten | Vollständiger Datenbankzugriff | Geschäftsführung |
| **🔴 Level 4** | **KRITISCH** | Systemweite Kompromittierung, externe Angreifer | Ransomware, APT-Angriff | Alle + Externe Hilfe |

### 3.2 Meldepflicht-Bewertung (Art. 33 DSGVO)

#### ✅ Meldepflichtig bei:
- Unbefugter Zugriff auf personenbezogene Daten
- Verlust von Datenträgern mit Personenbezug
- Versehentliche Weitergabe an Unbefugte
- Systemkompromittierung mit möglichem Datenzugriff

#### ❌ Nicht meldepflichtig bei:
- Technische Ausfälle ohne Datenzugriff
- Interne Bedienungsfehler ohne Datenleck
- Verlust bereits öffentlicher Informationen
- Vorfälle ohne Personenbezug

---

## 4. Sofortmaßnahmen-Checklisten

### 4.1 Erste 30 Minuten (Containment)

#### IT-Coordinator Checklist:
- [ ] **Zeitstempel dokumentieren** (Entdeckung, erste Maßnahme)
- [ ] **Incident Commander informieren** (Telefon + E-Mail)
- [ ] **Betroffene Systeme identifizieren** und dokumentieren
- [ ] **Schadensbegrenzung einleiten:**
  - [ ] Kompromittierte Benutzerkonten sperren
  - [ ] Verdächtige Netzwerkverbindungen trennen
  - [ ] Backup-Systeme vor Zugriff schützen
- [ ] **Evidence Preservation:**
  - [ ] System-Logs sichern (vor Überschreibung)
  - [ ] Screenshots/Fotos von Fehlermeldungen
  - [ ] Browser-Entwicklertools-Ausgaben exportieren

#### Incident Commander Checklist:
- [ ] **Team-Aktivierung** (alle Rollen benachrichtigen)
- [ ] **Incident-Nummer vergeben** (Format: INC-YYYY-MM-DD-##)
- [ ] **Erste Schadensbewertung:**
  - [ ] Anzahl betroffener Personen schätzen
  - [ ] Art der betroffenen Daten bewerten
  - [ ] Potentielle Auswirkungen einschätzen
- [ ] **Dokumentation starten** (Incident-Log anlegen)

### 4.2 Erste 2 Stunden (Assessment)

#### Detailanalyse:
- [ ] **Root Cause Analysis** starten
- [ ] **Umfang der Kompromittierung** bestimmen
- [ ] **Datentypen und -mengen** quantifizieren
- [ ] **Angreiferattribution** (intern/extern/unbekannt)
- [ ] **Potentielle Auswirkungen** für Betroffene bewerten

#### Rechtsbewertung:
- [ ] **Meldepflicht prüfen** (Art. 33/34 DSGVO)
- [ ] **72h-Frist** kalkulieren (ab Kenntniserlangung)
- [ ] **Externe Berater** kontaktieren (bei komplexen Fällen)
- [ ] **Versicherung** informieren (Cyber-Versicherung)

### 4.3 Erste 24 Stunden (Response)

#### Bei meldepflichtigen Vorfällen:
- [ ] **Aufsichtsbehörde-Meldung** vorbereiten
- [ ] **Betroffenen-Benachrichtigung** entwerfen
- [ ] **Interne Kommunikation** koordinieren
- [ ] **Recovery-Plan** entwickeln
- [ ] **Lessons Learned** Session planen

---

## 5. Meldeverfahren

### 5.1 Behördenmeldung (Art. 33 DSGVO)

**Zuständige Aufsichtsbehörde:**  
[Landesdatenschutzbehörde - Kontaktdaten einsetzen]

**Meldung binnen:** 72 Stunden ab Kenntniserlangung  
**Format:** Online-Formular + PDF-Nachlieferung

#### Meldepflichtiger Inhalt:
```
┌─ Incident-Meldung Art. 33 DSGVO ─────────────────────┐
│                                                      │
│ 1. ART DER VERLETZUNG:                              │
│    ☐ Vertraulichkeitsverletzung (unbefugter Zugriff)│
│    ☐ Verfügbarkeitsverletzung (Datenverlust)        │
│    ☐ Integritätsverletzung (Datenmanipulation)      │
│                                                      │
│ 2. BETROFFENE DATEN:                                │
│    • Datentypen: ________________________          │
│    • Anzahl Betroffene: __________________          │
│    • Anzahl Datensätze: ___________________         │
│                                                      │
│ 3. WAHRSCHEINLICHE FOLGEN:                          │
│    ____________________________________________      │
│                                                      │
│ 4. ERGRIFFENE/GEPLANTE MASSNAHMEN:                  │
│    ____________________________________________      │
│                                                      │
│ 5. KONTAKT:                                         │
│    Name: ___________________________________        │
│    Telefon: _______________________________         │
│    E-Mail: ________________________________         │
└──────────────────────────────────────────────────────┘
```

### 5.2 Betroffenen-Benachrichtigung (Art. 34 DSGVO)

**Pflicht bei:** Hohes Risiko für Rechte und Freiheiten  
**Frist:** Unverzüglich (ohne unangemessene Verzögerung)  
**Medium:** E-Mail, Brief oder persönlich

#### Benachrichtigungs-Template:
```
Betreff: Wichtige Information zu Ihren Daten - Datenschutzvorfall

Sehr geehrte/r [NAME],

wir müssen Sie über einen Vorfall informieren, der Ihre personenbezogenen 
Daten im FTG Sportfabrik Smart Staff Scheduler betreffen könnte.

WAS IST PASSIERT?
Am [DATUM] um [ZEIT] wurde festgestellt, dass [BESCHREIBUNG].

WELCHE DATEN SIND BETROFFEN?
☐ Name und Mitarbeiter-ID
☐ Schichtplanung-Daten  
☐ Verfügbarkeits-Angaben
☐ Urlaubs-/Abwesenheitsdaten
☐ [Andere]: _______________

WAHRSCHEINLICHE AUSWIRKUNGEN:
[Konkrete Risikobewertung für Betroffene]

UNSERE SOFORTMASSNAHMEN:
• [Maßnahme 1]
• [Maßnahme 2]  
• [Maßnahme 3]

WAS KÖNNEN SIE TUN?
• [Empfehlung 1]
• [Empfehlung 2]
• Bei Fragen: [KONTAKT]

IHR RECHT AUF BESCHWERDE:
Sie können sich bei der zuständigen Datenschutz-Aufsichtsbehörde 
beschweren: [KONTAKTDATEN]

Wir entschuldigen uns für diesen Vorfall und die damit verbundenen 
Unannehmlichkeiten.

Mit freundlichen Grüßen
[Datenschutzbeauftragte/r]
[DATUM]
```

---

## 6. Recovery und Business Continuity

### 6.1 System-Wiederherstellung

#### Prioritäten-Reihenfolge:
1. **Sicherheit wiederherstellen** (Malware entfernen, Patches einspielen)
2. **Datenintegrität prüfen** (Backup-Validierung, Konsistenz-Checks)
3. **Funktionalität testen** (Alle Features vor Freigabe validieren)
4. **Monitoring verstärken** (Erweiterte Überwachung für 30 Tage)

#### Recovery-Strategien:

**Lokaler Datenverlust:**
```bash
# Backup-Wiederherstellung aus Browser-Export
1. Letzten bekannten Export-Stand lokalisieren
2. Datenintegrität validieren (Checksummen prüfen) 
3. Import in neues System durchführen
4. Delta seit Backup manuell nachtragen
```

**Supabase-Kompromittierung:**
```bash
# Fallback auf lokale Systeme
1. Alle Clients auf localStorage-Only umstellen
2. Neue Supabase-Instanz aufsetzen
3. Saubere Daten von vertrauenswürdigen Clients sammeln
4. Nach Sicherheitsaudit: Resynchonisation
```

### 6.2 Business Continuity

**Minimal viable Service:**
- ✅ Schichtplanung für aktuellen Monat (lokale Daten)
- ✅ Notfall-Schichtverteilung per manueller Liste
- ✅ Kommunikation über etablierte Kanäle (E-Mail, WhatsApp)

**Recovery Time Objective (RTO):** 4 Stunden  
**Recovery Point Objective (RPO):** 24 Stunden

---

## 7. Post-Incident Aktivitäten

### 7.1 Forensik und Investigation

#### Obligatorische Analysen:
- [ ] **Timeline-Rekonstruktion** (vom Eintritt bis zur Entdeckung)
- [ ] **Impact Assessment** (finale Schadensbewertung)
- [ ] **Attribution Analysis** (Ursache und Verantwortlichkeiten)
- [ ] **Control Effectiveness Review** (Warum haben Schutzmaßnahmen versagt?)

#### Evidence-Sammlung:
- Server-/Browser-Logs (vor, während, nach Incident)
- Screenshots und Systemzustände  
- User-Activity-Protokolle
- Netzwerk-Traffic-Analysen (falls verfügbar)

### 7.2 Lessons Learned Workshop

**Zeitpunkt:** 2-4 Wochen nach Incident-Abschluss  
**Teilnehmer:** Incident Response Team + betroffene Stakeholder  
**Dauer:** 2-3 Stunden

#### Agenda:
1. **Incident-Chronologie** (Was ist passiert?)
2. **Response-Bewertung** (Was lief gut/schlecht?)
3. **Process-Improvements** (Wie können wir uns verbessern?)
4. **Control-Enhancements** (Welche zusätzlichen Sicherheitsmaßnahmen?)
5. **Action Items** (Konkrete Umsetzungsschritte mit Verantwortlichen)

### 7.3 Incident-Report

**Empfänger:** Geschäftsführung, IT-Verantwortliche, Datenschutzbeauftragte  
**Frist:** 30 Tage nach Incident-Abschluss

#### Report-Struktur:
```
1. EXECUTIVE SUMMARY
   • Incident-Art und -Dauer  
   • Betroffene Systeme und Personen
   • Geschäftsauswirkungen
   • Lessons Learned (3-5 Kernpunkte)

2. DETAILED TIMELINE
   • Chronologische Auflistung aller Ereignisse
   • Entscheidungspunkte und Wendemomente

3. ROOT CAUSE ANALYSIS  
   • Primäre und sekundäre Ursachen
   • Contributing Factors
   • System/Process-Schwächen

4. RESPONSE ASSESSMENT
   • Effektivität der Sofortmaßnahmen
   • Team-Performance und Kommunikation  
   • Einhaltung der Prozesse

5. RECOMMENDATIONS
   • Technische Verbesserungen (priorisiert)
   • Prozess-Optimierungen  
   • Trainings-Bedarfe
   • Budget-Anforderungen

6. ACTION PLAN
   • Konkrete Maßnahmen mit Timelines
   • Verantwortliche Personen
   • Success-Metriken
```

---

## 8. Kommunikationsplan

### 8.1 Interne Kommunikation

#### Stakeholder-Matrix:
| Zielgruppe | Information | Kanal | Timing |
|------------|-------------|-------|--------|
| **Geschäftsführung** | Strategische Entscheidungen | Telefon + E-Mail | Sofort |
| **IT-Team** | Technische Details | Slack + E-Mail | Sofort |
| **HR/Personal** | Mitarbeiter-Auswirkungen | E-Mail | 2-4h |
| **Alle Mitarbeiter** | Allgemeine Information | E-Mail + Intranet | 4-8h |

#### Kommunikations-Templates:

**Geschäftsführung (sofort):**
```
Betreff: [DRINGEND] Datenschutzvorfall - Sofortige Aufmerksamkeit erforderlich

• INCIDENT: [Kurzbeschreibung]
• AUSWIRKUNG: [Business Impact]  
• STATUS: [Aktueller Stand]
• NÄCHSTE SCHRITTE: [Geplante Maßnahmen]
• ENTSCHEIDUNG ERFORDERLICH: [Falls zutreffend]

Incident Commander: [Name + Telefon]
```

**Mitarbeiter (verzögert):**
```
Betreff: Information zu IT-Sicherheitsvorfall

Liebe Kolleginnen und Kollegen,

wir informieren Sie über einen IT-Sicherheitsvorfall, der unser 
Schichtplanungssystem betreffen könnte.

WAS IST PASSIERT: [Allgemeine Beschreibung]
IHRE DATEN: [Betroffenheit]  
UNSERE MASSNAHMEN: [Was wir tun]
WAS SIE TUN SOLLTEN: [Empfehlungen]

Für Fragen stehen wir zur Verfügung: [Kontakt]
```

### 8.2 Externe Kommunikation

**Medien-/Presseanfragen:**
- ✅ Alle Anfragen an Communications Lead weiterleiten
- ❌ Keine spontanen Statements von IT oder anderen Mitarbeitern
- 📋 Vorbereitete Statements für häufige Fragen verwenden

**Kunden-/Geschäftspartner:**
- Nur bei direkter Betroffenheit informieren
- Fokus auf Lösungsmaßnahmen, nicht Ursachen
- Vertrauen durch Transparenz und Kompetenz stärken

---

## 9. Präventive Maßnahmen

### 9.1 Incident-Prävention

#### Technische Maßnahmen:
- 🔒 **Erweiterte Monitoring** (CSP-Violations, Anomalieerkennung)
- 🛡️ **Security Headers** (HSTS, Referrer-Policy, etc.)
- 🔐 **Regelmäßige Security-Audits** (Code-Reviews, Penetration-Tests)
- 📋 **Automated Vulnerability Scanning** (Dependencies, Infrastructure)

#### Organisatorische Maßnahmen:
- 📚 **Regelmäßige Schulungen** (Security Awareness, Datenschutz)
- 🎯 **Tabletop-Exercises** (Incident Response Training)
- 📋 **Security-Policies** (Password-Policy, Access-Control)
- 🔄 **Continuous Improvement** (Post-Incident Reviews)

### 9.2 Early Warning System

**Monitoring-Alerting:**
```javascript
// Beispiel: Anomalie-Erkennung im Client
const securityMonitor = {
  // Ungewöhnliche Datenvolumen
  detectMassExport: () => { /* Alert bei >50 Datensätzen */ },
  
  // Verdächtige Zugriffsmuster  
  detectSuspiciousAccess: () => { /* Alert bei Zugriff außerhalb Arbeitszeit */ },
  
  // CSP-Violation-Cluster
  detectCSPViolations: () => { /* Alert bei >5 Violations/Stunde */ }
};
```

---

## 10. Testing und Wartung

### 10.1 Incident Response Testing

#### Quartalsweise Tabletop-Exercises:
- **Scenario 1:** Ransomware-Angriff auf Arbeitsplatz-PCs
- **Scenario 2:** Insider-Bedrohung (Mitarbeiter lädt Daten herunter)
- **Scenario 3:** Phishing-Erfolg mit Credential-Diebstahl
- **Scenario 4:** Supabase-Datenbank-Breach

#### Jährliche Full-Scale-Übung:
- Reale Systemabschaltung (geplant)
- Vollständige IR-Team-Aktivierung
- Externe Beobachter und Bewertung
- Management-Entscheidungen unter Zeitdruck

### 10.2 Plan-Wartung

**Aktualisierungsfrequenz:** Quartalsweise oder nach größeren Incidents  
**Verantwortlich:** Incident Commander + IT-Coordinator

#### Update-Trigger:
- Neue Bedrohungslandschaft (Zero-Day-Exploits, etc.)
- Organisationsänderungen (neue Mitarbeiter, Rollenwechsel)
- Technologie-Updates (neue Systemkomponenten)
- Rechtliche Änderungen (DSGVO-Updates, neue Gesetze)

---

## 11. Kontakte und Ressourcen

### 11.1 Notfall-Kontakte

| Rolle | Primär | Backup | Verfügbarkeit |
|-------|--------|--------|---------------|
| **Incident Commander** | [Name, Tel, E-Mail] | [Backup] | 24/7 |
| **IT-Coordinator** | [Name, Tel, E-Mail] | [Backup] | 24/7 |
| **Legal Officer** | [Name, Tel, E-Mail] | [Externe Kanzlei] | Bürozeit + Notfall |
| **Communications** | [Name, Tel, E-Mail] | [Backup] | Bürozeit |

### 11.2 Externe Unterstützung

| Service | Anbieter | Kontakt | SLA |
|---------|----------|---------|-----|
| **Cyber-Forensik** | [Externe Firma] | [Kontakt] | 4h Response |
| **Legal Support** | [Anwaltskanzlei] | [Kontakt] | 2h Response |
| **PR-Crisis Support** | [PR-Agentur] | [Kontakt] | 8h Response |
| **IT-Emergency** | [IT-Dienstleister] | [Kontakt] | 1h Response |

### 11.3 Behörden-Kontakte

**Datenschutz-Aufsichtsbehörde:**  
[Name der zuständigen Landesbehörde]  
Meldung: [Online-Portal-URL]  
Hotline: [Telefonnummer]  
E-Mail: [E-Mail-Adresse]

**Strafverfolgung (bei Cybercrime):**  
Bundes kriminalamt (BKA) - Cybercrime  
Zentrale Ansprechstelle Cybercrime (ZAC)  
Telefon: [Nummer]  
E-Mail: [E-Mail]

---

## 12. Anhänge

### 12.1 Incident-Classification-Flowchart
```
┌─ Datenschutz-Incident festgestellt ─────────────────┐
│                                                      │
├─ Personenbezogene Daten betroffen? ─────────────────┤
│  ❌ Nein → IT-Incident (kein Datenschutz-Incident)  │  
│  ✅ Ja ↓                                            │
├─ Unbefugter Zugriff/Verlust/Manipulation? ─────────┤
│  ❌ Nein → Monitoring, kein Incident               │
│  ✅ Ja ↓                                            │
├─ Hohes Risiko für Betroffene? ──────────────────────┤
│  ❌ Nein → Meldung nur an Aufsichtsbehörde (72h)    │
│  ✅ Ja ↓                                            │
├─ Betroffene informieren (unverzüglich) ─────────────┤
│  + Meldung an Aufsichtsbehörde (72h)               │
└──────────────────────────────────────────────────────┘
```

### 12.2 Communication-Templates

**E-Mail-Vorlagen für alle Szenarien verfügbar unter:**  
`/docs/incident-response/templates/`

### 12.3 Legal-Checklists

**DSGVO-Compliance-Checkliste für Meldungen verfügbar unter:**  
`/docs/incident-response/legal-compliance/`

---

**Status:** ⚠️ **ENTWURF** - Vor Produktionsstart zu finalisieren und durch Geschäftsführung zu genehmigen

**Version 1.0 - Letzte Aktualisierung: 20. September 2025**