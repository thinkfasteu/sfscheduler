# Data Subject Rights - Standard Operating Procedures

**Gültig ab:** 20. September 2025  
**Version:** 1.0  
**Verantwortlich:** FTG Sportfabrik GmbH  
**Zuständig:** Datenschutzbeauftragte/r

## 1. Übersicht der Betroffenenrechte

Die DSGVO gewährt betroffenen Personen umfassende Rechte bezüglich ihrer personenbezogenen Daten. Diese SOP definiert Verfahren zur ordnungsgemäßen Bearbeitung aller Anfragen.

### Rechtskatalog (DSGVO):
- **Art. 15** - Auskunftsrecht
- **Art. 16** - Recht auf Berichtigung  
- **Art. 17** - Recht auf Löschung ("Recht auf Vergessenwerden")
- **Art. 18** - Recht auf Einschränkung der Verarbeitung
- **Art. 20** - Recht auf Datenübertragbarkeit
- **Art. 21** - Widerspruchsrecht
- **Art. 77** - Recht auf Beschwerde bei Aufsichtsbehörde

---

## 2. Auskunftsrecht (Art. 15 DSGVO)

### 2.1 Bearbeitungsverfahren

**Frist:** 30 Tage (verlängerbar um weitere 60 Tage bei komplexen Fällen)  
**Zuständigkeit:** Datenschutzbeauftragte + IT-Verantwortlicher

#### Schritt-für-Schritt-Verfahren:

1. **Anfrage-Eingang** (Tag 1)
   - [ ] Anfrage in Ticket-System erfassen
   - [ ] Identität des Anfragenden prüfen (bei Zweifel Ausweis anfordern)
   - [ ] Eingangsbestätigung senden (spätestens 72h)

2. **Datensammlung** (Tag 2-7)
   - [ ] Mitarbeiterstammdaten aus System extrahieren
   - [ ] Verfügbarkeitsdaten der letzten 12 Monate
   - [ ] Schichtzuweisungen der letzten 2 Jahre
   - [ ] Urlaubsdaten aktuelles und vorheriges Jahr
   - [ ] Audit-Logs mit Personenbezug (letzte 12 Monate)
   - [ ] Einwilligungen und Zustimmungen

3. **Datenaufbereitung** (Tag 8-14)
   - [ ] Daten in lesbares Format konvertieren (PDF + CSV)
   - [ ] Erläuterungen zu Codes und Abkürzungen hinzufügen
   - [ ] Drittanbieterdaten markieren (Supabase, etc.)
   - [ ] Rechtsgrundlagen je Datentyp zuordnen

4. **Qualitätsprüfung** (Tag 15-20)
   - [ ] Vollständigkeit prüfen
   - [ ] Daten anderer Personen anonymisieren/entfernen
   - [ ] Rechtliche Bewertung (Auskunftshindernisse?)
   - [ ] Format-Validierung

5. **Übermittlung** (Tag 21-30)
   - [ ] Sichere Übermittlung (verschlüsselte E-Mail oder persönliche Abholung)
   - [ ] Begleitschreiben mit Erläuterungen
   - [ ] Hinweis auf weitere Rechte
   - [ ] Dokumentation der Auskunftserteilung

### 2.2 Auskunfts-Template

**Betreff:** Antwort auf Ihre Auskunftsanfrage gem. Art. 15 DSGVO

```
Sehr geehrte/r [NAME],

vielen Dank für Ihre Anfrage vom [DATUM]. Als Anlage erhalten Sie 
die vollständige Auskunft über die Sie betreffenden personenbezogenen 
Daten, die wir im FTG Sportfabrik Smart Staff Scheduler verarbeiten.

📋 AUSKUNFTSUMFANG:
• Mitarbeiterstammdaten (Anlage 1)
• Verfügbarkeits- und Schichtdaten (Anlage 2)  
• Urlaubs- und Abwesenheitsdaten (Anlage 3)
• Einwilligungen und Zustimmungen (Anlage 4)
• Audit-Protokolle (Anlage 5)

⚖️ RECHTSGRUNDLAGEN:
• Arbeitsvertragliche Pflichten (Art. 6.1.b DSGVO)
• Gesetzliche Verpflichtungen (Art. 6.1.c DSGVO) 
• Berechtigte Interessen (Art. 6.1.f DSGVO)
• Einwilligung (Art. 6.1.a DSGVO)

🎯 VERARBEITUNGSZWECKE:
• Schichtplanung und Arbeitsorganisation
• Einhaltung arbeitsrechtlicher Bestimmungen
• Fairness-Algorithmus für Schichtverteilung
• IT-Sicherheit und Compliance

📅 AUFBEWAHRUNGSFRISTEN:
• Stammdaten: 3 Jahre nach Vertragsende
• Schichtdaten: 2 Jahre (steuerliche Aufbewahrung)
• Verfügbarkeiten: 12 Monate rollierend
• Audit-Logs: 1 Jahr

👥 EMPFÄNGER:
• Personalverantwortliche FTG Sportfabrik
• Autorisierte Schichtplaner
• IT-Dienstleister (Supabase - EU-Hosting)

🌍 DRITTLANDÜBERMITTLUNG: Nein

🔄 IHRE WEITEREN RECHTE:
• Berichtigung unrichtiger Daten (Art. 16 DSGVO)
• Löschung (Art. 17 DSGVO) - soweit rechtlich zulässig
• Einschränkung der Verarbeitung (Art. 18 DSGVO)
• Datenübertragbarkeit (Art. 20 DSGVO)
• Widerspruch (Art. 21 DSGVO)
• Beschwerde bei Aufsichtsbehörde (Art. 77 DSGVO)

Bei Fragen stehen wir gerne zur Verfügung.

Mit freundlichen Grüßen
[Datenschutzbeauftragte/r]
```

---

## 3. Recht auf Berichtigung (Art. 16 DSGVO)

### 3.1 Bearbeitungsverfahren

**Frist:** 30 Tage  
**Sofortmaßnahme:** Korrektur binnen 24h bei offensichtlichen Fehlern

#### Verfahren:
1. **Prüfung der Berechtigung** (Tag 1-3)
   - [ ] Identität des Anfragenden verifizieren
   - [ ] Sachverhalt prüfen (ist Angabe tatsächlich falsch?)
   - [ ] Beweislage bewerten (Dokumente, Zeugen)

2. **Technische Umsetzung** (Tag 4-7)
   - [ ] Datenkorrektur im System durchführen
   - [ ] Historische Einträge kennzeichnen (nicht löschen!)
   - [ ] Audit-Log der Änderung erstellen
   - [ ] Backup-Konsistenz sicherstellen

3. **Nachrichtenpflicht** (Tag 8-14)
   - [ ] Empfänger der Daten informieren (falls weitergegebene Daten betroffen)
   - [ ] Interne Benachrichtigung an relevante Abteilungen
   - [ ] Betroffenen über Korrektur informieren

### 3.2 Berichtigung-Fälle

| Datentyp | Häufige Fehler | Korrekturverfahren |
|----------|----------------|-------------------|
| **Name** | Schreibfehler, Namenswechsel | Sofortige Korrektur + Nachweis |
| **Rolle** | Falsche Kategorisierung | Prüfung mit Personalabteilung |
| **Vertragsstunden** | Veraltete Angaben | Abgleich mit aktuellem Vertrag |
| **Verfügbarkeiten** | Falsche Eingaben | Korrektur durch Betroffenen selbst |

---

## 4. Recht auf Löschung (Art. 17 DSGVO)

### 4.1 Löschgründe und Prüfkriterien

#### Zulässige Löschgründe:
- ✅ **Zweckentfall:** Daten nicht mehr für ursprünglichen Zweck erforderlich
- ✅ **Widerruf:** Einwilligung wurde widerrufen und keine andere Rechtsgrundlage
- ✅ **Unrechtmäßigkeit:** Daten wurden unrechtmäßig verarbeitet
- ✅ **Compliance:** Löschung zur Erfüllung rechtlicher Verpflichtung

#### Löschausschlüsse:
- ❌ **Steuerrecht:** AO §147 - 10 Jahre Aufbewahrung für Lohndaten
- ❌ **Arbeitsrecht:** 3 Jahre Nachweispflicht für Arbeitszeiten
- ❌ **Sozialversicherung:** Meldepflichten SGB IV
- ❌ **Laufende Verfahren:** Bis Abschluss von Rechtsstreitigkeiten

### 4.2 Löschverfahren

**Frist:** 30 Tage  
**Sofortmaßnahme:** Sperrung binnen 72h bei berechtigten Anträgen

1. **Rechtsprüfung** (Tag 1-7)
   - [ ] Löschgrund gemäß Art. 17 Abs. 1 DSGVO prüfen
   - [ ] Ausschlusstatbestände nach Art. 17 Abs. 3 DSGVO prüfen
   - [ ] Gesetzliche Aufbewahrungspflichten bewerten
   - [ ] Berechtigte Interessen abwägen

2. **Löschfreigabe oder Ablehnung** (Tag 8-14)
   - [ ] Bei Freigabe: Technische Löschung veranlassen
   - [ ] Bei Ablehnung: Begründung erstellen
   - [ ] Betroffenen informieren

3. **Technische Umsetzung** (Tag 15-21)
   - [ ] Vollständige Löschung aus allen Systemen
   - [ ] Backup-Bereinigung (soweit technisch möglich)
   - [ ] Audit-Trail der Löschung
   - [ ] Verifikation der vollständigen Entfernung

### 4.3 Ablehnungsschreiben-Template

```
Betreff: Ihr Löschungsantrag vom [DATUM] - Art. 17 DSGVO

Sehr geehrte/r [NAME],

vielen Dank für Ihren Antrag auf Löschung Ihrer personenbezogenen 
Daten vom [DATUM].

Nach sorgfältiger rechtlicher Prüfung müssen wir Ihren Antrag 
teilweise/vollständig ablehnen.

GRUND DER ABLEHNUNG:
☑️ Gesetzliche Aufbewahrungspflicht (§ 147 AO - 10 Jahre)
☑️ Arbeitsrechtliche Nachweispflicht (§ 622 BGB - 3 Jahre)  
☑️ Laufendes Verfahren [AKTENZEICHEN]

BETROFFENE DATEN:
• Schichtpläne 2023-2025 (steuerliche Aufbewahrung bis 2035)
• Arbeitszeiten-Nachweise (Aufbewahrung bis 2028)

BEREITS GELÖSCHTE DATEN:
• Freiwillige Verfügbarkeitsangaben
• Widerrufene Einwilligungen
• Technische Protokolle älter als 12 Monate

AUTOMATISCHE LÖSCHUNG:
Die verbleibenden Daten werden automatisch gelöscht, sobald 
die gesetzlichen Aufbewahrungsfristen ablaufen.

IHR RECHT AUF BESCHWERDE:
Falls Sie mit dieser Entscheidung nicht einverstanden sind, 
können Sie sich an die zuständige Datenschutz-Aufsichtsbehörde 
wenden: [KONTAKTDATEN]

Mit freundlichen Grüßen
[Datenschutzbeauftragte/r]
```

---

## 5. Recht auf Einschränkung (Art. 18 DSGVO)

### 5.1 Einschränkungsgründe

- 🔍 **Richtigkeit bestritten:** Während Prüfung der Datenrichtigkeit
- ⚖️ **Unrechtmäßig:** Alternative zur Löschung bei Widerspruch der betroffenen Person
- 🎯 **Zweckentfall:** Verantwortlicher benötigt Daten nicht mehr, betroffene Person für Rechtsansprüche
- ❌ **Widerspruch:** Während Prüfung der Berechtigung

### 5.2 Technische Umsetzung

**Verfahren:** Daten-Sperrung statt Löschung
```sql
-- Beispiel Sperrung in der Datenbank  
UPDATE staff_data 
SET processing_restricted = true,
    restriction_reason = 'Art18_accuracy_disputed',
    restriction_date = NOW(),
    restricted_by = 'DPO'
WHERE staff_id = '[ID]';
```

**UI-Kennzeichnung:** Gesperrte Datensätze werden mit ⚠️-Symbol markiert und sind nur lesbar, nicht bearbeitbar.

---

## 6. Recht auf Datenübertragbarkeit (Art. 20 DSGVO)

### 6.1 Anwendungsbereich

**Voraussetzungen:**
- ✅ Verarbeitung auf Einwilligung oder Vertrag basiert
- ✅ Verarbeitung automatisiert erfolgt
- ❌ Nicht bei Verarbeitung für öffentliche Aufgaben

**Anwendbare Daten:** 
- Mitarbeiterstammdaten (vertraglich)
- Freiwillige Verfügbarkeitsangaben (Einwilligung)
- Persönliche Präferenzen (Einwilligung)

### 6.2 Übertragungsformat

**Standard-Export (JSON):**
```json
{
  "export_info": {
    "created": "2025-09-20T14:30:00Z",
    "format": "GDPR_Article_20_Export",
    "legal_basis": "Data_Portability_Request"
  },
  "personal_data": {
    "staff_info": {
      "name": "[NAME]",
      "role": "permanent", 
      "contract_hours": 40,
      "weekend_preference": true
    },
    "availability_preferences": [...],
    "consent_records": [...]
  }
}
```

**Alternative Formate:** CSV, XML auf Anfrage

---

## 7. Widerspruchsrecht (Art. 21 DSGVO)

### 7.1 Widerspruchsbereich

**Anwendbar bei Rechtsgrundlage "berechtigte Interessen" (Art. 6.1.f):**
- Fairness-Algorithmus-Berechnungen
- Compliance-Monitoring  
- IT-Sicherheits-Logs

**Nicht anwendbar:**
- Arbeitsvertragliche Verarbeitung (Art. 6.1.b)
- Gesetzliche Verpflichtungen (Art. 6.1.c)

### 7.2 Interessenabwägung

**Prüfkriterien:**
1. Liegt ein Grund vor, der sich aus der besonderen Situation der betroffenen Person ergibt?
2. Überwiegen die schutzwürdigen Interessen die berechtigten Interessen des Verantwortlichen?
3. Sind die Verarbeitungszwecke durch weniger eingriffsintensive Mittel erreichbar?

---

## 8. Fristen und Eskalation

### 8.1 Fristenübersicht

| Recht | Grundfrist | Verlängerung | Bedingung |
|-------|------------|--------------|-----------|
| **Auskunft** | 30 Tage | +60 Tage | Komplexität, mehrere Anfragen |
| **Berichtigung** | 30 Tage | +60 Tage | Aufwändige Prüfung |
| **Löschung** | 30 Tage | +60 Tage | Komplexe Rechtsprüfung |
| **Einschränkung** | 30 Tage | +60 Tage | Technische Schwierigkeiten |
| **Übertragbarkeit** | 30 Tage | +60 Tage | Große Datenmengen |
| **Widerspruch** | 30 Tage | +60 Tage | Aufwändige Interessenabwägung |

### 8.2 Eskalationsmatrix

| Stufe | Zeitpunkt | Verantwortlich | Maßnahme |
|-------|-----------|----------------|----------|
| **0** | Eingang | Datenschutzbeauftragte | Eingangsbestätigung |
| **1** | Tag 7 | DPO | Erste Zwischenmeldung |
| **2** | Tag 20 | DPO + Geschäftsführung | Fristwarnung |
| **3** | Tag 25 | Geschäftsführung | Notfall-Task-Force |
| **4** | Tag 30+ | Rechtsabteilung | Rechtfertigungsschreiben |

---

## 9. Dokumentation und Compliance

### 9.1 Tracking-System

**Pflichtfelder je Anfrage:**
- Eingangsdatum und -kanal
- Identität des Anfragenden (Verifikationsstatus)
- Art des beanspruchten Rechts
- Bearbeitungsstand und verantwortliche Person
- Fristenkontrolle (Ampelsystem)
- Ergebnis und Begründung
- Versandart und -datum der Antwort

### 9.2 Compliance-Reporting

**Monatsbericht an Geschäftsführung:**
- Anzahl eingegangener Anfragen (nach Recht)
- Durchschnittliche Bearbeitungszeit
- Fristüberschreitungen und Gründe
- Ablehnungsquote mit Begründungen
- Lessons Learned und Verbesserungsvorschläge

### 9.3 Audit-Vorbereitung

**Jährlicher Compliance-Check:**
- [ ] Stichprobenprüfung von 10% aller Betroffenenrechts-Fälle
- [ ] Fristeneinhaltung-Statistik
- [ ] Rechtmäßigkeits-Prüfung der Ablehnungen
- [ ] Schulungsstand der beteiligten Mitarbeiter
- [ ] Technische Löschverfahren-Verifikation

---

## 10. Notfallverfahren

### 10.1 Dringende Löschungsanträge

**Trigger:** Bedrohung der körperlichen Sicherheit oder erhebliche Nachteile

**Verfahren:**
1. **Sofortmaßnahme** (binnen 4 Stunden): Daten-Sperrung
2. **Rechtsprüfung** (binnen 24 Stunden): Begründetheit des Notfalls
3. **Endentscheidung** (binnen 72 Stunden): Löschung oder reguläres Verfahren

### 10.2 Behördenanfragen

**Reaktionszeit:** 14 Tage (Art. 58 DSGVO)  
**Eskalation:** Sofortige Information der Geschäftsführung und Rechtsabteilung

---

**Version 1.0 - Implementierung vor Produktionsstart erforderlich**