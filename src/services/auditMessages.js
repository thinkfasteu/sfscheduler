// Centralized audit message formatter
export function auditMsg(kind, meta={}){
  switch(kind){
    case 'vacation.add': return `Urlaub hinzugefügt: Mitarbeiter ${meta.staffId} ${meta.start} bis ${meta.end}`;
    case 'vacation.remove': return `Urlaub entfernt: Mitarbeiter ${meta.staffId} Index ${meta.index}`;
    case 'ledger.update': return `Urlaubs-Ledger aktualisiert: Mitarbeiter ${meta.staffId} Jahr ${meta.year} ent=${meta.entitlement} genommen=${meta.takenManual} carry=${meta.carryover}`;
    case 'carryover.set': return `Carryover gesetzt: Mitarbeiter ${meta.staffId} Monat ${meta.month} = ${meta.value}`;
    case 'sickness.add': return `Krankheitszeit hinzugefügt: Mitarbeiter ${meta.staffId} ${meta.start} bis ${meta.end}`;
    case 'sickness.replace': return `Krankheitszeiträume ersetzt: Mitarbeiter ${meta.staffId} Anzahl=${meta.count}`;
    case 'sickness.remove': return `Krankheitszeit entfernt: Mitarbeiter ${meta.staffId} Index ${meta.index}`;
  case 'overtime.request.create': return `Überstunden-Anfrage erstellt: Mitarbeiter ${meta.staffId} ${meta.date} (${meta.shift})`;
  case 'overtime.request.status': return `Überstunden-Anfrage Status geändert: ${meta.id||''} Mitarbeiter ${meta.staffId} ${meta.date} (${meta.shift}) -> ${meta.status}`;
  case 'overtime.consent.set': return `Überstunden-Einwilligung gesetzt: Mitarbeiter ${meta.staffId} Datum ${meta.date}`;
  case 'overtime.consent.remove': return `Überstunden-Einwilligung entfernt: Mitarbeiter ${meta.staffId} Datum ${meta.date}`;
    default: return kind;
  }
}
