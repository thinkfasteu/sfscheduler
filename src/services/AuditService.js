export function createAuditService(store){
  return {
  list(){ return store.auditList(); },
  async listRemote(){ if (store.remote && typeof store.remote.auditList==='function') { try { return await store.remote.auditList(); } catch { return []; } } return []; },
  log(message, meta){ return store.auditLog(message, meta); }
  };
}
