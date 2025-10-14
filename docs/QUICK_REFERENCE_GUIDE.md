# Quick Reference Guide
## FTG Sportfabrik Dienstplan-System

**Zielgruppe:** Dienstplaner:innen & Frontoffice-Teams  
**Stand:** 14. Oktober 2025

---

## 🚀 Einstieg

- **URL:** `https://scheduler.sportfabrik.de`
- **Login:** FTG SSO oder bereitgestellte Zugangsdaten
- **Unterstützte Browser:** Chrome, Firefox, Edge, Safari (jeweils aktuelle Version)

Nach dem Login öffnet sich der Monatskalender. Die aktuelle Auswahl sehen Sie oberhalb des Kalenders (Dropdown `Monat`).

---

## 📅 Monatsplan erzeugen

1. Monat im Dropdown wählen.
2. **Plan erstellen** klicken. Der Scheduler generiert Vorschläge für alle Schichten des Monats.
3. Vorgang bei Bedarf wiederholen – vorherige Zuordnungen werden überschrieben.

> Tipp: Das System speichert den letzten erfolgreichen Stand automatisch. Nichts wird final veröffentlicht, bevor Sie den Plan finalisieren.

---

## 👥 Manuelle Anpassungen

### Direkt im Kalender
1. Auf eine Schicht (Pill) klicken.
2. Modal öffnet den **Zuweisung / Tausch** Dialog.
3. Kandidat aus der Liste wählen und bestätigen.

### Kandidatenliste verstehen
- **Stabile Liste:** Alle verfügbaren Personen bleiben sichtbar. Blocker werden mit ⚠ gekennzeichnet.
- **Tooltip:** Mouseover zeigt Blocker-Grund, Wochenend-Zähler und Tagesstunden.
- **Filter:** Suchfeld und Checkboxen (`Festangestellte`, `Manager`) passen die Liste an.

### Manager-Wildcard
- Checkbox **Manager hinzufügen** aktivieren.
- Auswahl „Manager“ weist den Schichtplatz dem Management-Team zu, wird aber bei der Validierung speziell behandelt.

### Wochenend-Consent
- Für Festangestellte ohne Wochenend-Präferenz erscheint ein Zustimmungs-Kontrollkästchen.
- Zustimmung speichert sich im System (`permanentOvertimeConsent`).
- Gibt es keine Alternative, legt das System automatisch eine Überstunden-Anfrage an.

### Dialog „Suchen & Zuweisen“
- Öffnen über Button **Suchen & Zuweisen (Datum wählen)**.
- Dient für schichtübergreifende Zuweisungen.
- Nutzt dieselben Kandidatenregeln und Consent-Prüfungen.

---

## ✅ Validierung & Finalisierung

1. Klicken Sie **Plan finalisieren**.
2. Der Validator prüft: Ruhezeiten, maximale Tages-/Wochenlasten, Minijob-Earnings, kritische Schichten.
3. Ergebnisse:
	- ⚠ in Kandidatenlisten
	- Rot markierte Schichten im Kalender
	- Zusammenfassung unter dem Kalender (Screenreader-freundlich)
4. Solange Blocker existieren, lässt sich der Monat nicht finalisieren. Tooltip oder Finalisierungs-Dialog zeigt die Detailursache.
5. Nach erfolgreicher Finalisierung werden Daten in Supabase (falls konfiguriert) oder lokal gespeichert.

---

## 💾 Supabase & Offline-Betrieb

- **Mit Supabase:** Automatisches Speichern von Dienstplan, Verfügbarkeiten, Urlaub, Überstunden.
- **Ohne Supabase:** Lokale Speicherung im Browser (`appState`), alle Funktionen bleiben nutzbar.

Statusmeldungen erscheinen oben links (Synchronisierung, Fehler, Erfolg).

---

## 📤 Exporte & Berichte

| Aktion | Vorgehen |
|--------|----------|
| PDF-Dienstplan | Knopf **PDF Export** drücken → Download startet automatisch |
| Druckversion | **Drucken** wählen → Browser-Druckdialog öffnet |
| CSV/Analyse | Über Reports-Tab (separater Bereich) generieren |

---

## ⚠️ Häufige Blocker & Lösungen

| Blocker | Bedeutung | Lösung |
|---------|-----------|--------|
| `REST_PERIOD` | < 11 Stunden Ruhezeit | Andere Person wählen oder Schicht tauschen |
| `MAX_CONSECUTIVE_DAYS` | Mehr als 6 Tage am Stück | Freien Tag einplanen |
| `MINIJOB_EARNINGS_CAP` | > 520 € Monatsverdienst | Schicht an Werkstudent/in oder Manager vergeben |
| `CRITICAL_SHIFT_UNFILLED` | Pflicht-Schicht ohne Personal | Kandidaten mit ⚠ prüfen und zuweisen |

---

## 🆘 Troubleshooting

| Situation | Sofortmaßnahme |
|-----------|----------------|
| Buttons reagieren nicht | Seite neu laden, prüfen ob Banner „Synchronisiert ✓“ angezeigt wird |
| Kandidatenliste leer | Verfügbarkeit prüfen, Checkbox „Festangestellte“/„Manager“ aktivieren |
| Finalisierung blockiert | Finalisierungsdialog öffnen, Blocker in Reihenfolge abarbeiten |
| Supabase-Fehler | Internetverbindung prüfen, ggf. Technik informieren (Fällt auf lokalen Speicher zurück) |

---

## 📞 Ansprechpartner

| Thema | Kontakt | Erreichbarkeit |
|-------|---------|----------------|
| Technische Probleme | IT-Service: [Tel] / [E-Mail] | Mo–Fr 07–18 Uhr |
| Dienstplan-Fragen | Teamleitung Rezeption: [Tel] / [E-Mail] | Mo–So 08–22 Uhr |
| Datenschutz | Datenschutzbeauftragte:r: [Tel] / [E-Mail] | Mo–Fr 09–17 Uhr |
| Notfälle | Geschäftsführung: [Tel] | 24/7 |

---

**Fragen zur Anleitung?**  
📧 Schulungs-Team: [E-Mail]  
📞 Hotline: [Tel] (Mo–Fr 08–16 Uhr)