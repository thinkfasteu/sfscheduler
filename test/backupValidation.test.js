import { validateBackupObject } from '../src/utils/backup.js';

// Valid object
const valid = { schemaVersion:1, ts:new Date().toISOString(), data:{ foo: { a:1 } } };
const keys = validateBackupObject(valid);
if (!keys.includes('foo')) throw new Error('Expected key foo');

let failed = false;
try { validateBackupObject({}); } catch { failed = true; }
if (!failed) throw new Error('Expected invalid object rejection');

console.log('[test] backupValidation passed');