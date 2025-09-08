// Checklist Overlay UI Component
// Subscribes to services.events and renders a lightweight status panel.
(function(){
  if (typeof window==='undefined') return;
  function $(id){ return document.getElementById(id); }
  const rootId = 'scheduleChecklistRoot';
  function ensureRoot(){ let r=$(rootId); if(!r){ r=document.createElement('div'); r.id=rootId; document.body.appendChild(r);} return r; }
  const STEP_ORDER=['validate','fairness','overtime','save','reindex'];
  const LABELS={
    validate:'Validierungen', fairness:'Fairness / Wochenenden', overtime:'Überstunden / Limits', save:'Speichern', reindex:'Berichte'
  };
  const state={ visible:false, steps:{}, flags:[], summary:null, hideDisabled:false };
  function render(){
    const root=ensureRoot(); if(!state.visible){ root.innerHTML=''; return; }
    const stepsHtml=STEP_ORDER.map(id=>{ const s=state.steps[id]||{status:'pending'}; const statusClass=s.status==='ok'?'cl-status-ok': s.status==='error'?'cl-status-error':'cl-status-pending'; const icon=s.status==='ok'?'✓': s.status==='error'?'✕':'…'; return `<li data-step="${id}"><span class="cl-step-status ${statusClass}">${icon}</span><span class="cl-step-label">${LABELS[id]}</span></li>`; }).join('');
    const flagsHtml = state.flags.length ? `<div class="cl-flags" role="status">${state.flags.slice(-8).map(f=>`<div class="cl-flag-item">${escapeHtml(f)}</div>`).join('')}</div>` : '';
    const doneCount = STEP_ORDER.filter(id=> state.steps[id]?.status==='ok').length;
    const percent = Math.round((doneCount/STEP_ORDER.length)*100);
    root.innerHTML=`<div class="checklist-panel" role="dialog" aria-label="Planungs-Checkliste"><div class="checklist-header"><h4>Planungs-Checkliste</h4><button class="checklist-close" title="Schließen" aria-label="Schließen">×</button></div><div class="cl-progress" aria-hidden="true"><div class="cl-progress-bar" style="width:${percent}%"></div></div><ul class="checklist-steps">${stepsHtml}</ul>${flagsHtml}${state.summary?`<div class="cl-summary">${escapeHtml(state.summary.message||'Fertig')}</div>`:''}</div>`;
    root.querySelector('.checklist-close')?.addEventListener('click', hide);
  }
  function show(){ if(state.hideDisabled) return; state.visible=true; render(); }
  function hide(){ state.visible=false; render(); }
  function escapeHtml(s){ return String(s).replace(/[&<>\"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function onKey(e){ if(e.key==='Escape' && state.visible){ hide(); } }
  window.addEventListener('keydown', onKey);
  // Public API for tests
  window.__checklistUI = { show, hide, state };
  // Subscribe once services ready
  function attach(){ const sv = window.__services; if(!sv||!sv.events){ setTimeout(attach,200); return; }
    sv.events.on('schedule:checklist:start', ()=>{ show(); STEP_ORDER.forEach(id=> state.steps[id]={status:'pending'}); state.flags=[]; state.summary=null; render(); });
    sv.events.on('schedule:checklist:update', ({step})=>{ if(step&&step.id) { state.steps[step.id]={status:step.status}; render(); } });
    sv.events.on('schedule:checklist:flags', ({flags})=>{ if(Array.isArray(flags)){ state.flags=flags.slice(); render(); } });
    sv.events.on('schedule:checklist:complete', ({summary, steps, flags})=>{ if(steps){ steps.forEach(s=> state.steps[s.id]= {status:s.status}); } if(flags) state.flags=flags; state.summary=summary||{message:'Abgeschlossen'}; render(); /* auto hide after delay */ setTimeout(()=>{ if(state.visible) hide(); }, 6000); });
  }
  attach();
})();
