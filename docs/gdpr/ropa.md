# Records of Processing Activities (ROPA)
## Verzeichnis von Verarbeitungstätigkeiten - FTG Sportfabrik Smart Staff Scheduler

**Verantwortlicher:** FTG Sportfabrik GmbH  
**Erstellt:** 20. September 2025  
**Status:** Entwurf - Vor Produktionsstart zu finalisieren

---

## Verarbeitungstätigkeit 1: Mitarbeiterstammdaten-Verwaltung

| Kategorie | Details |
|-----------|---------|
| **Name der Verarbeitungstätigkeit** | Mitarbeiterstammdaten für Schichtplanung |
| **Zwecke der Verarbeitung** | Verwaltung von Mitarbeiterdaten für arbeitsrechtskonforme Schichtplanung |
| **Kategorien betroffener Personen** | Aktive Mitarbeiter (Festangestellt, Werkstudent, Minijob) |
| **Kategorien personenbezogener Daten** | Name, Rolle, Vertragsstunden, Typische Arbeitstage, Wochenendpräferenz |
| **Kategorien von Empfängern** | Personalverantwortliche, Schichtplaner, betroffene Mitarbeiter |
| **Übermittlungen an Drittländer** | Nein (EU-Hosting via Supabase) |
| **Fristen für die Löschung** | 3 Jahre nach Vertragsende |
| **Technische/organisatorische Maßnahmen** | RLS, Verschlüsselung, Zugriffskontrolle, CSP |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) |

---

## Verarbeitungstätigkeit 2: Verfügbarkeitsdaten-Erfassung

| Kategorie | Details |
|-----------|---------|
| **Name der Verarbeitungstätigkeit** | Mitarbeiterverfügbarkeit für Schichtplanung |
| **Zwecke der Verarbeitung** | Erfassung und Verwaltung von Arbeitszeiten-Verfügbarkeiten |
| **Kategorien betroffener Personen** | Aktive Mitarbeiter aller Kategorien |
| **Kategorien personenbezogener Daten** | Mitarbeiter-ID, Datum, Schichttyp, Verfügbarkeitsstatus, Freiwillige Angaben |
| **Kategorien von Empfängern** | Schichtplaner, Teamleiter |
| **Übermittlungen an Drittländer** | Nein |
| **Fristen für die Löschung** | 12 Monate rollierend |
| **Technische/organisatorische Maßnahmen** | Lokaler Browser-Speicher bevorzugt, optionale DB-Sync |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) |

---

## Verarbeitungstätigkeit 3: Schichtplan-Generierung und -Verwaltung

| Kategorie | Details |
|-----------|---------|
| **Name der Verarbeitungstätigkeit** | Automatisierte Schichtplanerstellung |
| **Zwecke der Verarbeitung** | Erstellung arbeitsrechtkonformer Schichtpläne, Fairness-Algorithmus |
| **Kategorien betroffener Personen** | Alle planungsrelevanten Mitarbeiter |
| **Kategorien personenbezogener Daten** | Schichtzuweisungen, Arbeitszeiten, Überstunden-Berechnungen |
| **Kategorien von Empfängern** | Schichtplaner, betroffene Mitarbeiter, Geschäftsführung |
| **Übermittlungen an Drittländer** | Nein |
| **Fristen für die Löschung** | Monatsende + 2 Jahre (steuerliche Aufbewahrung) |
| **Technische/organisatorische Maßnahmen** | Automatisierte Validierung, Audit-Trail, Versionierung |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung), Art. 6 Abs. 1 lit. c DSGVO (rechtliche Verpflichtung - ArbZG) |

---

## Verarbeitungstätigkeit 4: Überstunden-Zustimmungsverfahren

| Kategorie | Details |
|-----------|---------|
| **Name der Verarbeitungstätigkeit** | Dokumentation von Überstunden-Zustimmungen |
| **Zwecke der Verarbeitung** | Rechtssichere Dokumentation von Wochenendarbeit-Zustimmungen |
| **Kategorien betroffener Personen** | Festangestellte Mitarbeiter mit Wochenendschichten |
| **Kategorien personenbezogener Daten** | Mitarbeiter-ID, Datum, Zustimmungsstatus, Zustimmungszeitpunkt |
| **Kategorien von Empfängern** | Personalverantwortliche, Schichtplaner, Arbeitsschutz |
| **Übermittlungen an Drittländer** | Nein |
| **Fristen für die Löschung** | 3 Jahre (arbeitsrechtliche Nachweispflicht) |
| **Technische/organisatorische Maßnahmen** | Eindeutige Zuordnung, Unveränderlichkeit, Audit-Log |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. a DSGVO (Einwilligung), Art. 6 Abs. 1 lit. c DSGVO (rechtliche Verpflichtung) |

---

## Verarbeitungstätigkeit 5: Urlaubs- und Abwesenheitsverwaltung

| Kategorie | Details |
|-----------|---------|
| **Name der Verarbeitungstätigkeit** | Verwaltung von Urlaubstagen und Krankheitszeiten |
| **Zwecke der Verarbeitung** | Urlaubsplanung, Krankheitserfassung, Schichtplanung-Integration |
| **Kategorien betroffener Personen** | Alle Mitarbeiter |
| **Kategorien personenbezogener Daten** | Mitarbeiter-ID, Datum, Abwesenheitstyp (Urlaub/Krankheit), Stunden |
| **Kategorien von Empfängern** | Personalverantwortliche, Schichtplaner |
| **Übermittlungen an Drittländer** | Nein |
| **Fristen für die Löschung** | 2 Jahre nach Kalenderjahr (Urlaubsabrechnung) |
| **Technische/organisatorische Maßnahmen** | Jahresweise Speicherung, automatische Archivierung |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung), Art. 6 Abs. 1 lit. c DSGVO (rechtliche Verpflichtung) |

---

## Verarbeitungstätigkeit 6: System-Audit und Fehlerprotokollierung

| Kategorie | Details |
|-----------|---------|
| **Name der Verarbeitungstätigkeit** | Technische Systemüberwachung und Compliance-Audit |
| **Zwecke der Verarbeitung** | Systemsicherheit, Compliance-Nachweis, Fehleranalyse |
| **Kategorien betroffener Personen** | Systemnutzer (Mitarbeiter und Planer) |
| **Kategorien personenbezogener Daten** | Benutzer-ID, Zeitstempel, Aktionstyp, IP-Adresse (gehashed) |
| **Kategorien von Empfängern** | IT-Verantwortliche, Datenschutzbeauftragte |
| **Übermittlungen an Drittländer** | Nein |
| **Fristen für die Löschung** | Audit-Logs: 1 Jahr, Fehler-Logs: 30 Tage |
| **Technische/organisatorische Maßnahmen** | Pseudonymisierung, Verschlüsselung, Zugriffsbeschränkung |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse - Systemsicherheit) |

---

## Auftragsverarbeiter / Dienstleister

| Dienstleister | Service | Standort | DPA Status | Anmerkungen |
|---------------|---------|----------|------------|-------------|
| **Supabase Inc.** | Backend-Database & Auth | EU (Frankfurt) | ✅ Standard DPA | Nur bei Aktivierung der zentralen DB |
| **Cloudflare** | CDN (jsPDF Library) | EU | ✅ Standard DPA | Nur für PDF-Generierung |
| **GitHub Pages** | Static Hosting | Global (EU verfügbar) | ✅ GitHub DPA | Für Web-App-Hosting |

---

## Datenschutz-Folgenabschätzung (DSFA)

**Erforderlich:** Nein - Geringes Risiko aufgrund:
- Minimaler personenbezogener Daten
- Keine besonderen Kategorien nach Art. 9 DSGVO
- Lokale Datenhaltung bevorzugt
- Starke technische Schutzmaßnahmen

**Monitoring:** Jährliche Überprüfung bei Systemerweiterungen

---

## Aktualisierung und Wartung

**Verantwortlich:** [Name des Datenschutzbeauftragten]  
**Prüfzyklus:** Halbjährlich  
**Letzte Prüfung:** 20. September 2025  
**Nächste Prüfung:** März 2026

---

**Hinweis:** Dieses ROPA ist vor Produktionsstart durch den Datenschutzbeauftragten zu überprüfen und zu genehmigen.