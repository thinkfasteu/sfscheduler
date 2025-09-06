export function createAuditService(store){
  return {
    list(){ return store.auditList(); },
    log(message, meta){ return store.auditLog(message, meta); }
  };
}
