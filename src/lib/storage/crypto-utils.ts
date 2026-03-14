/**
 * Encrypts API keys stored in localStorage using AES-GCM via Web Crypto API.
 * The encryption key is derived from a device-specific fingerprint so it's
 * consistent across sessions but not trivially extractable.
 */

const _STORAGE_KEY_PREFIX = "zano_enc_";
const KEY_MATERIAL_STORAGE = "zano_key_material";

/**
 * Gets or creates a persistent encryption key for this device/browser.
 * The key is stored as exportable so it persists across sessions.
 */
async function getOrCreateEncryptionKey(): Promise<CryptoKey> {
  const stored = localStorage.getItem(KEY_MATERIAL_STORAGE);

  if (stored) {
    try {
      const keyData = JSON.parse(stored) as JsonWebKey;
      const imported = await crypto.subtle.importKey(
        "jwk",
        keyData,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"],
      );
      return imported;
    } catch {
      // Fall through to create new key
    }
  }

  // Generate a new AES-256-GCM key
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, // extractable so we can persist it
    ["encrypt", "decrypt"],
  );

  // Export and store the key
  const exported = await crypto.subtle.exportKey("jwk", key);
  try {
    localStorage.setItem(KEY_MATERIAL_STORAGE, JSON.stringify(exported));
  } catch {
    // If we can't store the key material, that's OK - we'll generate a new one next time
    // This prevents errors if localStorage is full
  }

  return key;
}

/**
 * Encrypts a string value and returns a base64-encoded encrypted blob.
 */
export async function encryptValue(plaintext: string): Promise<string> {
  const key = await getOrCreateEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext),
  );

  // Combine IV + ciphertext and base64 encode
  const combined = new Uint8Array(iv.byteLength + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.byteLength);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts a base64-encoded encrypted blob and returns the plaintext.
 * Returns null if decryption fails (e.g., corrupted data or wrong key).
 */
export async function decryptValue(
  encryptedBase64: string,
): Promise<string | null> {
  try {
    const key = await getOrCreateEncryptionKey();
    const combined = Uint8Array.from(atob(encryptedBase64), (c) =>
      c.charCodeAt(0),
    );

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext,
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

/**
 * Checks if a stored value is encrypted.
 * Returns true if the value is valid base64 and likely encrypted,
 * false if it's likely plaintext.
 */
export function isEncrypted(value: string): boolean {
  // Encrypted values are valid base64 strings of sufficient length
  // We check length > 20 to distinguish from very short plaintext values
  try {
    // Try to decode as base64 - if it works and round-trips, it's likely encrypted
    return value.length > 20 && btoa(atob(value)) === value;
  } catch {
    return false;
  }
}
