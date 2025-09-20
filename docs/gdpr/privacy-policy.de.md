# Datenschutzerklärung - FTG Sportfabrik Smart Staff Scheduler

**Verantwortlicher:** FTG Sportfabrik GmbH  
**Datum:** 20. September 2025  
**Version:** 1.0

## 1. Allgemeine Informationen

Diese Datenschutzerklärung informiert Sie über die Verarbeitung personenbezogener Daten im FTG Sportfabrik Smart Staff Scheduler (nachfolgend "Anwendung"). Die Anwendung dient der Planung und Verwaltung von Arbeitsschichten unter Einhaltung deutscher Arbeitsgesetze.

## 2. Verantwortlicher

**FTG Sportfabrik GmbH**  
[Adresse einsetzen]  
[E-Mail einsetzen]  
[Telefon einsetzen]

**Datenschutzbeauftragter:** [Name und Kontaktdaten einsetzen, falls erforderlich]

## 3. Verarbeitete Daten

### 3.1 Mitarbeiterdaten
- **Name:** Vollständiger Name für Schichtplanung und rechtliche Compliance
- **Rolle:** Arbeitsvertragstyp (Festangestellt, Werkstudent, Minijob)
- **Vertragsstunden:** Wöchentliche Sollarbeitszeit
- **Typische Arbeitstage:** Anzahl regelmäßiger Arbeitstage pro Woche
- **Wochenendpräferenz:** Bereitschaft zu Wochenendarbeit
- **Alternative Wochenendtage:** Spezifische Wochentage für alternative Wochenendregelung

### 3.2 Verfügbarkeitsdaten
- **Verfügbarkeitszeiten:** Pro Mitarbeiter, Datum und Schicht
- **Freiwillige Schichten:** Zusätzliche Verfügbarkeitsangaben
- **Auszeiten:** Urlaubstage und Krankheitstage

### 3.3 Schichtplanungsdaten
- **Schichtzuweisungen:** Datum, Schichttyp, zugewiesener Mitarbeiter
- **Überstundenzustimmungen:** Dokumentierte Zustimmung zu Wochenendarbeit (permanent Angestellte)
- **Änderungshistorie:** Protokoll von Planungsänderungen

### 3.4 Technische Daten
- **Fehlerprotokolle:** Technische Fehlermeldungen ohne Personenbezug
- **Audit-Logs:** Systemaktivitäten mit Benutzerzuordnung
- **Sitzungsdaten:** Temporäre Anmeldeinformationen

## 4. Rechtsgrundlagen

| Zweck | Rechtsgrundlage (DSGVO) | Beschreibung |
|-------|-------------------------|--------------|
| Arbeitsschichtplanung | Art. 6 Abs. 1 lit. b | Erfüllung arbeitsvertraglicher Pflichten |
| Arbeitszeitgesetze-Compliance | Art. 6 Abs. 1 lit. c | Einhaltung gesetzlicher Verpflichtungen (ArbZG, JArbSchG) |
| Überstundenzustimmung | Art. 6 Abs. 1 lit. a | Einwilligung für Wochenendarbeit |
| Audit und Compliance | Art. 6 Abs. 1 lit. f | Berechtigtes Interesse an ordnungsgemäßer Betriebsführung |

## 5. Datenspeicherung und -übertragung

### 5.1 Lokale Speicherung
- **Primäre Speicherung:** Browserspeicher (localStorage) des jeweiligen Arbeitsplatzes
- **Zweck:** Offline-Funktionalität und Datenschutz durch Minimierung zentraler Speicherung

### 5.2 Zentrale Datenbank (optional)
- **Anbieter:** Supabase (gehostet in der EU)
- **Zweck:** Synchronisation zwischen mehreren Arbeitsplätzen
- **Sicherheit:** Zeilenlevel-Sicherheit (RLS), Verschlüsselung in Transit und at Rest

### 5.3 Datenübertragung
- **Verschlüsselung:** Alle Datenübertragungen erfolgen über HTTPS/WSS
- **Minimierung:** Nur notwendige Daten werden übertragen

## 6. Speicherdauer

| Datentyp | Aufbewahrungsfrist | Löschkriterium |
|----------|-------------------|----------------|
| Mitarbeiterstammdaten | Bis 3 Jahre nach Vertragsende | Automatische Löschung |
| Verfügbarkeitsdaten | 12 Monate | Rollierender Löschzyklus |
| Schichtpläne (aktuelle) | Bis Monatsende + 2 Jahre | Steuerliche Aufbewahrungspflicht |
| Überstundenzustimmungen | 3 Jahre | Arbeitsrechtliche Nachweispflicht |
| Audit-Logs | 1 Jahr | Compliance-Nachweis |
| Fehlerprotokolle | 30 Tage | Technische Optimierung |

## 7. Ihre Rechte

### 7.1 Auskunftsrecht (Art. 15 DSGVO)
Sie haben das Recht, Auskunft über die Sie betreffenden gespeicherten Daten zu erhalten.

### 7.2 Berichtigungsrecht (Art. 16 DSGVO)
Sie können die Berichtigung unrichtiger Daten verlangen.

### 7.3 Löschungsrecht (Art. 17 DSGVO)
Sie können die Löschung Ihrer Daten verlangen, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.

### 7.4 Einschränkung der Verarbeitung (Art. 18 DSGVO)
Sie können die Einschränkung der Verarbeitung verlangen.

### 7.5 Widerspruchsrecht (Art. 21 DSGVO)
Sie können der Verarbeitung widersprechen, soweit diese auf berechtigten Interessen beruht.

### 7.6 Datenübertragbarkeit (Art. 20 DSGVO)
Sie haben das Recht, Ihre Daten in einem strukturierten Format zu erhalten.

### 7.7 Widerruf von Einwilligungen
Erteilte Einwilligungen (z.B. für Überstundenarbeit) können jederzeit widerrufen werden.

**Ausübung der Rechte:** Wenden Sie sich an [Kontaktdaten des Verantwortlichen]

## 8. Technische und organisatorische Maßnahmen

### 8.1 Datensicherheit
- Content Security Policy (CSP) gegen Code-Injection
- Verschlüsselte Datenübertragung (HTTPS/WSS)
- Zeilenlevel-Sicherheit in der Datenbank
- Regelmäßige Sicherheitsupdates

### 8.2 Zugriffskontrolle
- Benutzerauthentifizierung erforderlich
- Rollenbased Zugriffskontrolle
- Audit-Protokollierung aller Zugriffe

### 8.3 Datenschutz durch Technikgestaltung
- Datenminimierung: Nur erforderliche Daten werden erhoben
- Lokale Speicherung bevorzugt
- Automatische Löschzyklen implementiert

## 9. Datenschutz-Folgenabschätzung

Eine Datenschutz-Folgenabschätzung wurde durchgeführt. Das Risiko wird als gering eingestuft aufgrund:
- Minimaler Speicherung personenbezogener Daten
- Starker technischer Schutzmaßnahmen
- Lokaler Datenhaltung

## 10. Beschwerderecht

Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde über die Verarbeitung Ihrer Daten zu beschweren.

**Zuständige Behörde:** [Landesdatenschutzbehörde einsetzen]

## 11. Änderungen

Diese Datenschutzerklärung kann bei Änderungen der Anwendung oder rechtlichen Anforderungen angepasst werden. Die aktuelle Version ist in der Anwendung verfügbar.

---

**Hinweis:** Diese Datenschutzerklärung muss vor Produktionsstart durch einen Datenschutzexperten überprüft und an die spezifischen Gegebenheiten von FTG Sportfabrik angepasst werden.