export type CredentialStorageMode = "device" | "session";

const STORAGE_MODE_KEY = "zanosheets-credential-storage";

function getSafeLocalStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function getSafeSessionStorage(): Storage | null {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

export function getLocalStorage(): Storage | null {
  return getSafeLocalStorage();
}

export function getSessionStorage(): Storage | null {
  return getSafeSessionStorage();
}

export function getCredentialStorageMode(): CredentialStorageMode {
  const storage = getSafeLocalStorage();
  if (!storage) return "device";
  try {
    const value = storage.getItem(STORAGE_MODE_KEY);
    return value === "session" ? "session" : "device";
  } catch {
    return "device";
  }
}

export function setCredentialStorageMode(mode: CredentialStorageMode): void {
  const storage = getSafeLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_MODE_KEY, mode);
  } catch {
    // ignore storage failures
  }
}

export function getCredentialStorage(): Storage {
  const mode = getCredentialStorageMode();
  if (mode === "session") {
    const session = getSafeSessionStorage();
    if (session) return session;
  }
  const local = getSafeLocalStorage();
  if (local) return local;
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  } as Storage;
}
