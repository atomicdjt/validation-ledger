let geminiApiKey: string | null = null;
const legacyStorageKey = 'validation_ledger_gemini_key';

export function clearLegacyPersistedGeminiApiKey(): void {
  if (typeof globalThis.localStorage !== 'undefined') {
    globalThis.localStorage.removeItem(legacyStorageKey);
  }
}

export function getGeminiApiKey(): string | null {
  return geminiApiKey;
}

export function setGeminiApiKey(value: string): void {
  geminiApiKey = value.trim() || null;
}
