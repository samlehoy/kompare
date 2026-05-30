const AUDIT_UPGRADE_PREFILL_KEY = 'kompare95:audit-upgrade-prefill';
const STORAGE_PROBE_KEY = `${AUDIT_UPGRADE_PREFILL_KEY}:probe`;
let memoryStorage;

function createMemoryStorage() {
  const values = new Map();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      const normalizedKey = String(key);
      return values.has(normalizedKey) ? values.get(normalizedKey) : null;
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key) {
      values.delete(String(key));
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    },
  };
}

function getMemoryStorage() {
  memoryStorage ||= createMemoryStorage();
  return memoryStorage;
}

function hasStorageApi(storage) {
  return storage
    && typeof window.Storage === 'function'
    && storage instanceof window.Storage
    && typeof storage.getItem === 'function'
    && typeof storage.setItem === 'function'
    && typeof storage.removeItem === 'function';
}

function getStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const storage = window.localStorage;
    if (!hasStorageApi(storage)) return getMemoryStorage();
    storage.setItem(STORAGE_PROBE_KEY, '1');
    storage.removeItem(STORAGE_PROBE_KEY);
    return storage;
  } catch {
    return getMemoryStorage();
  }
}

export function writeAuditUpgradePrefill(payload = {}) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(AUDIT_UPGRADE_PREFILL_KEY, JSON.stringify({
    parts: payload.parts || {},
    count: payload.count || Object.keys(payload.parts || {}).length,
  }));
}

export function readAuditUpgradePrefill() {
  const storage = getStorage();
  if (!storage) return null;
  const raw = storage.getItem(AUDIT_UPGRADE_PREFILL_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    storage.removeItem(AUDIT_UPGRADE_PREFILL_KEY);
    return null;
  }
}

export function clearAuditUpgradePrefill() {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(AUDIT_UPGRADE_PREFILL_KEY);
}

export { AUDIT_UPGRADE_PREFILL_KEY };
