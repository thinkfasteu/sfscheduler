# Lawful Basis Register - FTG Sportfabrik Smart Staff Scheduler

**Erstellt:** 20. September 2025  
**Version:** 1.0  
**Verantwortlich:** FTG Sportfabrik GmbH

## Übersicht

Dieses Register dokumentiert die Rechtsgrundlagen für alle Verarbeitungszwecke gemäß DSGVO Art. 6 und ordnet sie den jeweiligen Datenfeldern zu.

---

## 1. Arbeitsvertragliche Verarbeitung (Art. 6 Abs. 1 lit. b DSGVO)

### **Zweck:** Erfüllung arbeitsvertraglicher Pflichten

| Verarbeitungsaktivität | Datenfelder | Begründung | Erforderlichkeit |
|------------------------|-------------|------------|------------------|
| **Schichtplanung** | Name, Rolle, Vertragsstunden, Typische Arbeitstage | Arbeitsverträge enthalten Arbeitszeitvereinbarungen, die durch ordnungsgemäße Schichtplanung umgesetzt werden müssen | ✅ Unbedingt erforderlich |
| **Arbeitszeit-Verfügbarkeit** | Mitarbeiter-ID, Verfügbarkeitszeiten, Schichtpräferenzen | Koordination der Arbeitszeiten entsprechend vertraglicher Vereinbarungen | ✅ Unbedingt erforderlich |
| **Urlaubsplanung** | Urlaubstage, Jahres-Urlaubskonten, Carry-over | Umsetzung des gesetzlichen und vertraglichen Urlaubsanspruchs (BUrlG) | ✅ Unbedingt erforderlich |

**Löschung:** Mit Beendigung des Arbeitsvertrags + gesetzliche Nachweisfristen

---

## 2. Gesetzliche Verpflichtungen (Art. 6 Abs. 1 lit. c DSGVO)

### **Zweck:** Einhaltung arbeitsrechtlicher und steuerrechtlicher Bestimmungen

| Gesetz/Verordnung | Datenfelder | Verarbeitungsaktivität | Pflicht |
|-------------------|-------------|------------------------|---------|
| **Arbeitszeitgesetz (ArbZG)** | Schichtzuweisungen, Pausenzeiten, Ruhezeiten | Sicherstellung 11h-Ruhezeit, max. 6 aufeinanderfolgende Arbeitstage | § 3, § 5, § 6 ArbZG |
| **Jugendarbeitsschutzgesetz (JArbSchG)** | Alter (implizit durch Student-Status), Arbeitszeiten, Schichttypen | Schutz minderjähriger Studenten vor unzulässigen Arbeitszeiten | § 8, § 14 JArbSchG |
| **Abgabenordnung (AO)** | Schichtpläne, Arbeitsstunden, Überstunden-Dokumentation | Steuerliche Aufbewahrungspflicht für Lohnabrechnungsgrundlagen | § 147 AO (10 Jahre) |
| **Sozialgesetzbuch IV (SGB IV)** | Arbeitszeiten Minijob, Monatsstunden, Verdienstgrenzen | Sozialversicherungsrechtliche Grenzen für geringfügige Beschäftigung | § 8 SGB IV |
| **Betriebssicherheitsverordnung (BetrSichV)** | Wochenendarbeit-Dokumentation, Überstunden-Zustimmungen | Nachweis ordnungsgemäßer Arbeitszeitgestaltung | § 3 BetrSichV |

**Aufbewahrungsfristen:** Je nach Gesetz 2-10 Jahre

---

## 3. Einwilligung (Art. 6 Abs. 1 lit. a DSGVO)

### **Zweck:** Explizite Zustimmung für bestimmte Verarbeitungen

| Einwilligungsgegenstand | Datenfelder | Widerrufbarkeit | Nachweis |
|-------------------------|-------------|-----------------|----------|
| **Wochenendarbeit (Permanent)** | Überstunden-Zustimmungen, Wochenendschicht-Assignments | ✅ Jederzeit widerrufbar | Datum, Zeit, digitale Signatur |
| **Freiwillige Zusatzschichten** | Freiwillige Verfügbarkeitsangaben, Vol-Markierungen | ✅ Jederzeit widerrufbar | Selbst-Markierung in UI |
| **Alternative Wochenendtage** | Alternative Wochenendtage, spezifische Zustimmungen | ✅ Jederzeit widerrufbar | Per-Datum-Zustimmung |

**Besonderheiten:**
- Einwilligung muss **freiwillig, informiert, spezifisch und eindeutig** sein
- Widerruf wirkt nur für die Zukunft, nicht rückwirkend
- Koppelungsverbot: Verweigerung darf nicht zu arbeitsrechtlichen Nachteilen führen

---

## 4. Berechtigte Interessen (Art. 6 Abs. 1 lit. f DSGVO)

### **Zweck:** Schutz der berechtigten Interessen des Verantwortlichen

| Berechtigtes Interesse | Datenfelder | Abwägungstest | Ergebnis |
|------------------------|-------------|---------------|----------|
| **IT-Sicherheit und Systemschutz** | Audit-Logs, Anmelde-Protokolle, Fehler-Logs | Schutz vor Cyberattacken vs. Privatsphäre der Nutzer | ✅ Überwiegend berechtigt (minimale Daten, kurze Speicherung) |
| **Compliance-Überwachung** | Änderungshistorie, Systemaktivitäten, Validierungsprotokolle | Ordnungsgemäße Betriebsführung vs. Mitarbeiterüberwachung | ✅ Überwiegend berechtigt (geschäftskritisch, anonymisiert wo möglich) |
| **Fairness-Algorithmus** | Wochenend-Verteilung, Schichthistorie, Workload-Balancing | Gerechtigkeit in der Schichtverteilung vs. umfassende Datenanalyse | ✅ Überwiegend berechtigt (dient Mitarbeiterinteressen) |

**Interessenabwägung dokumentiert:** ✅ Durchgeführt am 20.09.2025

---

## 5. Spezielle Kategorien und Ausnahmen

### 5.1 Keine besonderen Kategorien (Art. 9 DSGVO)
- ❌ Keine Gesundheitsdaten (Krankheitstage nur als Anzahl, nicht Diagnose)
- ❌ Keine biometrischen Daten
- ❌ Keine ethnischen/religiösen Informationen
- ❌ Keine Gewerkschaftszugehörigkeit

### 5.2 Keine Profiling-Aktivitäten (Art. 22 DSGVO)
- ✅ Algorithmische Schichtverteilung erfolgt **transparent** und **überprüfbar**
- ✅ Menschliche Eingriffsrechte jederzeit gewährleistet
- ✅ Keine automatisierten Entscheidungen über Arbeitsverträge

---

## 6. Rechtsgrundlagen-Mapping nach Funktionsbereichen

### 6.1 Staff Management
```
┌─ Stammdaten ──────────────────┐
│ • Name               → Art. 6.1.b │
│ • Rolle              → Art. 6.1.b │  
│ • Vertragsstunden    → Art. 6.1.b │
│ • Wochenendpräferenz → Art. 6.1.a │
└───────────────────────────────┘
```

### 6.2 Schedule Generation
```
┌─ Algorithmus ─────────────────┐
│ • Zuweisung          → Art. 6.1.b │
│ • Validation         → Art. 6.1.c │
│ • Fairness-Scoring   → Art. 6.1.f │
│ • Audit-Trail        → Art. 6.1.f │
└───────────────────────────────┘
```

### 6.3 Availability & Vacation
```
┌─ Verfügbarkeit ──────────────┐
│ • Arbeitszeiten      → Art. 6.1.b │
│ • Freiwillige Angaben → Art. 6.1.a │
│ • Urlaubstage        → Art. 6.1.b │
│ • Krankheitstage     → Art. 6.1.c │
└───────────────────────────────┘
```

### 6.4 Reporting & Analytics
```
┌─ Berichte ───────────────────┐
│ • Arbeitsstunden     → Art. 6.1.c │
│ • Überstunden        → Art. 6.1.c │
│ • Compliance-Reports → Art. 6.1.f │
│ • Fairness-Metriken  → Art. 6.1.f │
└───────────────────────────────┘
```

---

## 7. Änderungsprotokoll

| Datum | Version | Änderung | Grund |
|-------|---------|----------|-------|
| 20.09.2025 | 1.0 | Erste Erstellung | Produktionsstart-Vorbereitung |
| | | | |

---

## 8. Genehmigung und Freigabe

**Erstellt durch:** [Name des Datenschutzbeauftragten]  
**Geprüft durch:** [Name der Rechtsabteilung]  
**Genehmigt durch:** [Name der Geschäftsführung]  

**Status:** ⚠️ ENTWURF - Vor Produktionsstart zu finalisieren

---

**Hinweis:** Alle Rechtsgrundlagen sind vor Produktionsstart durch qualifizierte Datenschutz- und Arbeitsrechtsexperten zu validieren.