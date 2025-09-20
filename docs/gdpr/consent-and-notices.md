# Consent and Notices - FTG Sportfabrik Smart Staff Scheduler

**Datum:** 20. September 2025  
**Version:** 1.0  
**Gültigkeit:** Produktionsstart bis Widerruf

## 1. Manager-Hinweise und Verfahren

### 1.1 Einführungshinweis für Führungskräfte

**Betreff: Neues digitales Schichtplanungssystem - Datenschutzrechtliche Hinweise**

Liebe Führungskräfte,

mit der Einführung des FTG Sportfabrik Smart Staff Schedulers übernehmen Sie wichtige datenschutzrechtliche Verantwortungen. Dieses Dokument informiert Sie über die rechtlichen Anforderungen und Verfahren.

#### Ihre Aufgaben:
1. **Information der Mitarbeiter** über das neue System vor erster Nutzung
2. **Einholung erforderlicher Einwilligungen** für freiwillige Funktionen
3. **Beachtung der Betroffenenrechte** bei Anfragen
4. **Dokumentation von Zustimmungen** und Widerrufen

#### Wichtige Grundsätze:
- ✅ **Freiwilligkeit:** Wochenendarbeit-Zustimmungen dürfen nicht erzwungen werden
- ✅ **Transparenz:** Mitarbeiter müssen über Datenverarbeitung informiert sein
- ✅ **Zweckbindung:** Daten nur für Schichtplanung verwenden
- ❌ **Koppelungsverbot:** Keine arbeitsrechtlichen Nachteile bei Verweigerung

### 1.2 Schulungsprotokoll für Manager

**Zu schulende Inhalte:**
- [ ] DSGVO-Grundlagen für Personalverantwortliche
- [ ] Umgang mit Betroffenenrechten (Auskunft, Löschung, etc.)
- [ ] Einwilligungsverfahren für Wochenendarbeit
- [ ] Dokumentationspflichten
- [ ] Datenpannen-Meldeverfahren

**Schulungsnachweis:**
```
Name: _________________________ 
Abteilung: _____________________
Datum: ________________________
Unterschrift: ___________________
```

---

## 2. Mitarbeiter-Informationen

### 2.1 Allgemeine Datenschutzinformation (für alle Mitarbeiter)

**🔒 Datenschutz im neuen Schichtplanungssystem**

Liebe Kolleginnen und Kollegen,

FTG Sportfabrik führt ein neues digitales System für die Schichtplanung ein. Hier die wichtigsten Informationen zum Datenschutz:

#### Was wird gespeichert?
- **Grunddaten:** Name, Vertragsart, Arbeitsstunden
- **Verfügbarkeiten:** Ihre Angaben zu möglichen Arbeitszeiten
- **Schichtpläne:** Zugewiesene Schichten und Arbeitszeiten
- **Urlaubstage:** Geplante und genommene Urlaubszeiten

#### Ihre Rechte:
- ℹ️ **Auskunft:** Sie können jederzeit erfahren, welche Daten gespeichert sind
- ✏️ **Berichtigung:** Falsche Daten können korrigiert werden  
- 🗑️ **Löschung:** Daten werden automatisch nach gesetzlichen Fristen gelöscht
- ⛔ **Widerspruch:** Sie können der Verarbeitung widersprechen (soweit rechtlich möglich)

#### Datensicherheit:
- 🔐 Ihre Daten sind durch moderne Verschlüsselung geschützt
- 👥 Zugriff nur für autorisierte Personen
- 🇪🇺 Speicherung ausschließlich in der EU

**Bei Fragen wenden Sie sich an:** [Kontaktdaten Datenschutzbeauftragter]

### 2.2 Spezialhinweis für Permanent-Angestellte

**⚠️ Wichtige Information: Wochenendarbeit und Einwilligung**

Als Permanent-Angestellte/r haben Sie die Möglichkeit, Wochenendschichten zu übernehmen. Dafür ist Ihre **ausdrückliche Einwilligung** erforderlich.

#### Was bedeutet das?
- 📋 **Freiwillig:** Sie müssen nicht zustimmen
- ⏰ **Flexibel:** Sie können Ihre Zustimmung jederzeit zurückziehen
- ⚖️ **Rechtssicher:** Ihre Zustimmung wird datenschutzkonform dokumentiert
- 🚫 **Keine Nachteile:** Verweigerung hat keine arbeitsrechtlichen Konsequenzen

#### Wie funktioniert die Zustimmung?
1. Das System fragt Sie vor Wochenendschicht-Zuweisung
2. Sie können per Klick zustimmen oder ablehnen
3. Ihre Entscheidung wird mit Datum/Zeit gespeichert
4. Widerruf jederzeit über das System möglich

**Rechtliche Grundlage:** DSGVO Art. 6 Abs. 1 lit. a (Einwilligung)

---

## 3. Einwilligungstexte und -verfahren

### 3.1 Wochenendarbeit-Einwilligung (Permanent-Angestellte)

#### Einwilligungstext (Systemanzeige):
```
┌─────────────────────────────────────────────────────────┐
│ 🔔 Einwilligung zur Wochenendarbeit erforderlich         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Für die Zuweisung der Wochenendschicht am [DATUM]       │
│ benötigen wir Ihre ausdrückliche Einwilligung.          │
│                                                         │
│ ✓ Ich willige ein, dass meine Bereitschaft zur         │
│   Wochenendarbeit am [DATUM] gespeichert wird.         │
│                                                         │
│ ⚠️ Diese Einwilligung ist freiwillig und kann          │
│    jederzeit widerrufen werden.                        │
│                                                         │
│ 📋 Rechtsgrundlage: DSGVO Art. 6 Abs. 1 lit. a        │
│                                                         │
│ [ Einwilligen ]  [ Ablehnen ]  [ Mehr Infos ]          │
└─────────────────────────────────────────────────────────┘
```

#### Dokumentationsschema:
```json
{
  "employeeId": "EMP001",
  "consentType": "weekend_overtime",
  "date": "2025-10-15",
  "shiftType": "weekend_early",
  "consentGiven": true,
  "timestamp": "2025-09-20T14:30:00Z",
  "ipAddress": "[HASHED]",
  "userAgent": "[BROWSER_INFO]",
  "consentText": "[FULL_TEXT_HASH]"
}
```

### 3.2 Alternative Wochenendtage-Einwilligung

#### Einwilligungstext:
```
┌─────────────────────────────────────────────────────────┐
│ 📅 Alternative Wochenendtage - Einwilligung             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Sie haben eine Wochenendpräferenz aktiviert.           │
│ Das System möchte Ihnen auch alternative Wochenendtage │
│ (z.B. Dienstag/Donnerstag statt Samstag/Sonntag)      │
│ zuweisen.                                               │
│                                                         │
│ ✓ Ich stimme zu, dass alternative Wochenendtage        │
│   für mich geplant werden können.                      │
│                                                         │
│ Alternative Tage: [AUSWAHL: Mo/Di/Mi/Do/Fr]            │
│                                                         │
│ 🔄 Diese Einstellung kann jederzeit geändert werden.   │
│                                                         │
│ [ Zustimmen ]  [ Nur reguläre Wochenenden ]            │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Freiwillige Zusatzschichten-Markierung

#### UI-Text:
```
┌─────────────────────────────────────────────────────────┐
│ 🙋 Freiwillige Zusatzverfügbarkeit                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Markieren Sie zusätzliche Zeiten, in denen Sie         │
│ freiwillig arbeiten können.                            │
│                                                         │
│ ⚠️ Hinweis: Diese Angaben sind freiwillig und          │
│    verpflichten Sie nicht zur Arbeitsleistung.         │
│                                                         │
│ ✓ Meine Markierungen dürfen für die Schichtplanung     │
│   berücksichtigt werden.                               │
│                                                         │
│ 🗑️ Löschung jederzeit möglich über [Button]           │
│                                                         │
│ [ Verstanden ]                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Widerrufsverfahren

### 4.1 Widerruf über die Anwendung

#### Benutzerführung:
1. **Menü:** "Meine Daten" → "Einwilligungen verwalten"
2. **Anzeige:** Liste aller erteilten Einwilligungen mit Datum
3. **Aktion:** "Widerrufen"-Button neben jeder Einwilligung
4. **Bestätigung:** Sicherheitsabfrage vor Widerruf
5. **Dokumentation:** Automatische Protokollierung des Widerrufs

#### Widerruf-Bestätigung:
```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ Einwilligung widerrufen?                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Sie sind dabei, folgende Einwilligung zu widerrufen:   │
│                                                         │
│ 📋 Typ: Wochenendarbeit-Zustimmung                     │
│ 📅 Erteilt am: 15.09.2025, 14:30 Uhr                  │
│ 🎯 Bezieht sich auf: Alle zukünftigen Wochenenden     │
│                                                         │
│ ⚡ Auswirkung: Keine automatische Zuweisung von        │
│    Wochenendschichten mehr. Bereits geplante           │
│    Schichten bleiben bestehen.                         │
│                                                         │
│ ✓ Ich bestätige den Widerruf                          │
│                                                         │
│ [ Endgültig widerrufen ]  [ Abbrechen ]                │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Widerruf außerhalb der Anwendung

**E-Mail-Vorlage für Mitarbeiter:**
```
An: datenschutz@ftg-sportfabrik.de
Betreff: Widerruf Einwilligung - Schichtplanungssystem

Sehr geehrte Damen und Herren,

hiermit widerrufe ich meine Einwilligung zur Verarbeitung 
personenbezogener Daten im Schichtplanungssystem.

Mitarbeiter-ID: _______________
Name: _______________________
Zu widerrufende Einwilligung: 
[ ] Wochenendarbeit-Zustimmung
[ ] Alternative Wochenendtage
[ ] Freiwillige Zusatzverfügbarkeiten
[ ] Alle Einwilligungen

Ich bitte um schriftliche Bestätigung des Widerrufs.

Mit freundlichen Grüßen
[Unterschrift]
[Datum]
```

**Bearbeitungszeit:** Maximal 72 Stunden  
**Bestätigung:** Automatisch per E-Mail

---

## 5. Dokumentation und Nachweise

### 5.1 Einwilligungs-Register

**Aufbewahrung:** 3 Jahre nach Widerruf/Vertragsende  
**Format:** Digitales Register mit Hash-Verifikation  
**Zugriff:** Nur Datenschutzbeauftragte und autorisierte IT-Mitarbeiter

#### Felder je Einwilligung:
- Mitarbeiter-ID (pseudonymisiert)
- Einwilligungstyp und -zweck
- Vollständiger Einwilligungstext (Hash)
- Erteilungsdatum/-zeit (UTC)
- Technische Metadaten (IP-Hash, Browser)
- Status (aktiv/widerrufen)
- Widerrufsdatum (falls zutreffend)

### 5.2 Compliance-Dashboard

**Funktionen:**
- 📊 Überblick über Einwilligungsquoten
- ⚠️ Warnung bei fehlenden Einwilligungen
- 📅 Erinnerung an Überprüfungsfristen
- 🔍 Audit-Trail für alle Änderungen

### 5.3 Behördenanfragen

**Reaktionszeit:** 14 Tage (Art. 58 DSGVO)  
**Bereitstellungsformat:** Strukturierte PDF oder Excel-Export  
**Anonymisierung:** Automatische Schwärzung nicht-angefragter Daten

---

## 6. Schulungsunterlagen

### 6.1 Quick-Reference-Card für Manager

```
┌─ DSGVO QUICK GUIDE ──────────────────────────────────┐
│                                                      │
│ ✅ VOR Systemnutzung:                               │
│   • Mitarbeiter informieren                         │
│   • Datenschutzerklärung aushändigen                │
│                                                      │
│ ⚠️ BEI Einwilligungen:                              │
│   • Freiwilligkeit betonen                          │
│   • Widerrufsmöglichkeit erklären                   │
│   • Dokumentation sicherstellen                     │
│                                                      │
│ 🚨 BEI Problemen:                                   │
│   • Datenschutzbeauftragten kontaktieren            │
│   • Keine eigenmächtigen Löschungen                 │
│   • Betroffenenrechte respektieren                  │
│                                                      │
│ 📞 Hotline: [TELEFON]                              │
│ 📧 E-Mail: datenschutz@ftg-sportfabrik.de          │
└──────────────────────────────────────────────────────┘
```

### 6.2 FAQ für Mitarbeiter

**F: Muss ich Wochenendschichten akzeptieren?**  
A: Nein, die Zustimmung ist freiwillig und hat keine arbeitsrechtlichen Nachteile.

**F: Kann ich meine Zustimmung später ändern?**  
A: Ja, jederzeit über das System oder per E-Mail an den Datenschutzbeauftragten.

**F: Wer sieht meine Daten?**  
A: Nur autorisierte Personen (Personalplanung, IT-Support, Datenschutzbeauftragte).

**F: Wie lange werden meine Daten gespeichert?**  
A: Je nach Datentyp 1-3 Jahre, siehe Datenschutzerklärung für Details.

**F: Was passiert bei einem Datenschutzverstoß?**  
A: Sofortige Benachrichtigung aller Betroffenen und der Aufsichtsbehörde.

---

## 7. Inkrafttreten und Aktualisierung

**Gültig ab:** Produktionsstart der Anwendung  
**Überprüfung:** Jährlich oder bei Systemänderungen  
**Zuständig:** Datenschutzbeauftragte/r  
**Genehmigung:** ⚠️ Vor Produktionsstart durch Geschäftsführung erforderlich

---

**Version 1.0 - Freigabe ausstehend**