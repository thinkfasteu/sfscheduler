# Data Retention Policy - FTG Sportfabrik Smart Staff Scheduler

**Gültig ab:** 20. September 2025  
**Version:** 1.0  
**Verantwortlich:** FTG Sportfabrik GmbH  

## 1. Grundsätze

Diese Richtlinie definiert die Aufbewahrungsfristen für alle im FTG Sportfabrik Smart Staff Scheduler verarbeiteten personenbezogenen Daten. Sie stellt sicher, dass:

- Daten nur so lange gespeichert werden, wie für den Zweck erforderlich
- Gesetzliche Aufbewahrungspflichten eingehalten werden
- Betroffenenrechte respektiert werden
- Automatisierte Löschprozesse implementiert sind

## 2. Datenklassifizierung und Aufbewahrungsfristen

### 2.1 Mitarbeiterstammdaten

| Datenfeld | Beschreibung | Aufbewahrungsfrist | Rechtsgrundlage | Löschkriterium |
|-----------|--------------|-------------------|----------------|----------------|
| **Mitarbeiter-ID** | Interne Identifikation | 3 Jahre nach Vertragsende | Arbeitsrecht | Automatisch |
| **Name (vollständig)** | Vor- und Nachname | 3 Jahre nach Vertragsende | Arbeitsrecht | Automatisch |
| **Rolle/Vertragstyp** | Permanent/Student/Minijob | 3 Jahre nach Vertragsende | Arbeitsrecht | Automatisch |
| **Vertragsstunden** | Wöchentliche Sollarbeitszeit | 3 Jahre nach Vertragsende | Arbeitsrecht | Automatisch |
| **Typische Arbeitstage** | Regelmäßige Wochentage | 3 Jahre nach Vertragsende | Arbeitsrecht | Automatisch |
| **Wochenendpräferenz** | Bereitschaft Wochenendarbeit | 3 Jahre nach Vertragsende | Arbeitsrecht | Automatisch |
| **Alternative Wochenendtage** | Spezifische Wochentage | 3 Jahre nach Vertragsende | Arbeitsrecht | Automatisch |

**Löschverfahren:** Automatisierte Löschung nach 3 Jahren ab Inaktivierung des Mitarbeiterkontos

### 2.2 Verfügbarkeitsdaten

| Datenfeld | Beschreibung | Aufbewahrungsfrist | Rechtsgrundlage | Löschkriterium |
|-----------|--------------|-------------------|----------------|----------------|
| **Verfügbarkeitszeiten** | Pro Mitarbeiter/Datum/Schicht | 12 Monate | Operativ | Rollierend monatlich |
| **Freiwillige Angaben** | Zusätzliche Verfügbarkeiten | 12 Monate | Operativ | Rollierend monatlich |
| **Auszeiten-Markierungen** | Nicht verfügbare Zeiten | 12 Monate | Operativ | Rollierend monatlich |

**Löschverfahren:** Rollierender 12-Monats-Zyklus, automatische Löschung am Monatsanfang

### 2.3 Schichtplanungsdaten

| Datenfeld | Beschreibung | Aufbewahrungsfrist | Rechtsgrundlage | Löschkriterium |
|-----------|--------------|-------------------|----------------|----------------|
| **Aktuelle Schichtpläne** | Laufender und nächster Monat | Bis Monatsende + 2 Jahre | Steuerrecht (AO §147) | Nach 2 Jahren + 1 Tag |
| **Schichtzuweisungen** | Mitarbeiter-Schicht-Zuordnung | Bis Monatsende + 2 Jahre | Steuerrecht | Nach 2 Jahren + 1 Tag |
| **Änderungshistorie** | Planungsmodifikationen | Bis Monatsende + 2 Jahre | Compliance | Nach 2 Jahren + 1 Tag |
| **Fairness-Berechnungen** | Algorithmus-Scores | 6 Monate | Operativ | Rollierend halbjährlich |

**Löschverfahren:** Automatische Archivierung nach Monatsende, Löschung nach 2 Jahren steuerlicher Aufbewahrung

### 2.4 Überstunden und Zustimmungen

| Datenfeld | Beschreibung | Aufbewahrungsfrist | Rechtsgrundlage | Löschkriterium |
|-----------|--------------|-------------------|----------------|----------------|
| **Überstunden-Zustimmungen** | Dokumentierte Einwilligungen | 3 Jahre | ArbZG §7, BGB §622 | Nach 3 Jahren |
| **Wochenendarbeit-Konsent** | Permanent-Mitarbeiter Zustimmung | 3 Jahre | Arbeitsrecht | Nach 3 Jahren |
| **Zustimmungs-Zeitstempel** | Wann Zustimmung erteilt | 3 Jahre | Nachweis | Nach 3 Jahren |
| **Widerruf-Dokumentation** | Zurückgezogene Zustimmungen | 3 Jahre | Rechtssicherheit | Nach 3 Jahren |

**Löschverfahren:** Jährliche Überprüfung, automatische Löschung abgelaufener Zustimmungen

### 2.5 Urlaubs- und Abwesenheitsdaten

| Datenfeld | Beschreibung | Aufbewahrungsfrist | Rechtsgrundlage | Löschkriterium |
|-----------|--------------|-------------------|----------------|----------------|
| **Urlaubstage** | Genommene Urlaubszeiten | 2 Jahre nach Kalenderjahr | BUrlG | 31. Dezember + 2 Jahre |
| **Krankheitstage** | Dokumentierte Ausfallzeiten | 2 Jahre nach Kalenderjahr | ENTGFG | 31. Dezember + 2 Jahre |
| **Jahres-Urlaubskonten** | Verfügbare/verbrauchte Tage | 2 Jahre nach Kalenderjahr | BUrlG | 31. Dezember + 2 Jahre |
| **Carry-over Berechnungen** | Übertragene Urlaubstage | 2 Jahre nach Auflösung | BUrlG | Nach Ausgleich + 2 Jahre |

**Löschverfahren:** Jahresende-Archivierung, automatische Löschung nach Ablauf der 2-Jahres-Frist

### 2.6 Technische und Audit-Daten

| Datenfeld | Beschreibung | Aufbewahrungsfrist | Rechtsgrundlage | Löschkriterium |
|-----------|--------------|-------------------|----------------|----------------|
| **Audit-Logs** | Systemaktivitäten mit User-ID | 1 Jahr | Compliance, IT-Sicherheit | Rollierend jährlich |
| **Fehler-Protokolle** | Technische Fehlermeldungen | 30 Tage | Systembetrieb | Rollierend monatlich |
| **Anmelde-Logs** | Login/Logout-Zeitstempel | 90 Tage | IT-Sicherheit | Rollierend vierteljährlich |
| **CSP-Violation-Logs** | Sicherheitsereignisse | 60 Tage | IT-Sicherheit | Rollierend 2-monatlich |

**Löschverfahren:** Automatisierte Rotation, älteste Einträge werden überschrieben

## 3. Ausnahmen und Verlängerungen

### 3.1 Gesetzliche Anforderungen
- **Steuerprüfung:** Verlängerung auf 10 Jahre bei laufender Betriebsprüfung
- **Arbeitsgerichtsverfahren:** Aufbewahrung bis Verfahrensende + 1 Jahr
- **Behördliche Anordnung:** Sperrung der Löschung bei behördlicher Anweisung

### 3.2 Betroffenenrechte
- **Löschungsanfrage (Art. 17 DSGVO):** Vorzeitige Löschung außer bei gesetzlicher Aufbewahrungspflicht
- **Einschränkung (Art. 18 DSGVO):** Sperrung statt Löschung bei strittigen Fällen
- **Widerspruch (Art. 21 DSGVO):** Einstellung der Verarbeitung, Prüfung der Löschung

## 4. Technische Umsetzung

### 4.1 Automatisierte Löschprozesse
```javascript
// Beispiel-Pseudocode für automatische Löschzyklen
const RETENTION_RULES = {
  availability: { months: 12, trigger: 'monthly' },
  audit_logs: { months: 12, trigger: 'monthly' },
  error_logs: { days: 30, trigger: 'daily' },
  staff_data: { years: 3, trigger: 'contract_end' }
};
```

### 4.2 Lösch-Monitoring
- **Dashboard:** Übersicht über anstehende und durchgeführte Löschungen
- **Benachrichtigungen:** Automatische Warnungen vor Ablauf gesetzlicher Fristen
- **Protokollierung:** Audit-Trail aller Löschvorgänge

## 5. Verantwortlichkeiten

| Rolle | Verantwortlichkeit |
|-------|-------------------|
| **Datenschutzbeauftragter** | Überwachung der Einhaltung, jährliche Überprüfung |
| **IT-Verantwortlicher** | Technische Umsetzung der Löschprozesse |
| **Personalleitung** | Meldung von Vertragsenden für Mitarbeiterdaten-Löschung |
| **Schichtplaner** | Einhaltung der operativen Löschfristen |

## 6. Dokumentation und Nachweis

### 6.1 Lösch-Protokoll
Jede automatische und manuelle Löschung wird dokumentiert:
- Datum und Uhrzeit der Löschung
- Art und Umfang der gelöschten Daten
- Rechtsgrundlage für die Löschung
- Durchführende Person/System

### 6.2 Auskunfts- und Beweispflichten
- **Betroffenenanfragen:** Nachweis über gelöschte Daten innerhalb 30 Tage
- **Behördenanfragen:** Dokumentation der Löschzyklen für Compliance-Prüfungen

## 7. Inkrafttreten und Überprüfung

**Inkrafttreten:** Mit Produktionsstart der Anwendung  
**Überprüfung:** Jährlich oder bei wesentlichen Systemänderungen  
**Nächste Überprüfung:** September 2026  

## 8. Notfallverfahren

### 8.1 Vorzeitige Löschung
Bei Sicherheitsvorfällen oder Compliance-Verstößen:
1. Sofortige Sperrung der betroffenen Daten
2. Risikobeurteilung durch Datenschutzbeauftragten
3. Entscheidung über vorzeitige Löschung oder Wiederherstellung

### 8.2 Datenrettung
Bei versehentlicher Löschung:
1. Sofortiger Stopp aller automatischen Löschprozesse
2. Prüfung verfügbarer Backups (max. 30 Tage)
3. Selektive Wiederherstellung unter Datenschutz-Gesichtspunkten

---

**Genehmigung erforderlich:** Diese Richtlinie ist vor Produktionsstart durch den Datenschutzbeauftragten und die Geschäftsführung zu genehmigen.