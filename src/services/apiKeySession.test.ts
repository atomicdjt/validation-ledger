import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearLegacyPersistedGeminiApiKey, getGeminiApiKey, setGeminiApiKey } from './apiKeySession';

describe('Gemini API key session', () => {
  afterEach(() => {
    setGeminiApiKey('');
    vi.unstubAllGlobals();
  });

  it('keeps a trimmed key in memory for the current page session', () => {
    setGeminiApiKey('  test-key  ');
    expect(getGeminiApiKey()).toBe('test-key');
  });

  it('clears the in-memory key when given blank input', () => {
    setGeminiApiKey('test-key');
    setGeminiApiKey('  ');
    expect(getGeminiApiKey()).toBeNull();
  });

  it('removes a key persisted by an earlier release', () => {
    const removeItem = vi.fn();
    vi.stubGlobal('localStorage', { removeItem });

    clearLegacyPersistedGeminiApiKey();

    expect(removeItem).toHaveBeenCalledWith('validation_ledger_gemini_key');
  });
});
