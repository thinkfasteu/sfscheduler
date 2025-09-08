// Scheduling Checklist Service
// Emits UI-friendly events for scheduling operations; thin wrapper around services.events
export function createChecklistService(services){
  const state = {
    active: false,
    steps: [
      { id: 'validate', label: 'Validierungen prüfen', status: 'pending' },
      { id: 'fairness', label: 'Fairness / Wochenenden', status: 'pending' },
      { id: 'overtime', label: 'Überstunden / Limits', status: 'pending' },
      { id: 'save', label: 'Speichern', status: 'pending' },
      { id: 'reindex', label: 'Berichte aktualisieren', status: 'pending' }
    ],
    flags: [],
    summary: null
  };
  function emit(evt,payload){ services.events.emit(evt,payload); }
  function start(ctx={}){
    state.active = true;
    state.steps.forEach(s=> s.status='pending');
    state.flags.length = 0;
    state.summary = null;
    emit('schedule:checklist:start',{ ctx, steps: state.steps.map(s=>({...s})) });
  }
  function updateStep(id, status){
    const step = state.steps.find(s=>s.id===id);
    if (step){ step.status = status; emit('schedule:checklist:update',{ step:{...step} }); }
  }
  function addFlags(list){
    if (!Array.isArray(list) || !list.length) return;
    for (const f of list){ state.flags.push(f); }
    emit('schedule:checklist:flags', { flags: state.flags.slice(-30) });
  }
  function complete(summary){
    state.summary = summary || {};
    emit('schedule:checklist:complete', { summary: state.summary, steps: state.steps, flags: state.flags });
    state.active = false;
  }
  return { start, updateStep, addFlags, complete, _state: state };
}
