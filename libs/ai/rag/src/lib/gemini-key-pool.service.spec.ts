import { GeminiKeyPool } from './gemini-key-pool.service';

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation((apiKey: string) => ({ apiKey }))
}));

describe('GeminiKeyPool', () => {
  const originalKeys = process.env.GEMINI_API_KEYS;
  const originalLegacyKey = process.env.LLM_API_KEY;
  const originalCooldown = process.env.GEMINI_KEY_COOLDOWN_MS;
  const originalRetryBase = process.env.GEMINI_RETRY_BASE_MS;

  beforeEach(() => {
    process.env.GEMINI_API_KEYS = 'key-a,key-b';
    process.env.LLM_API_KEY = '';
    process.env.GEMINI_KEY_COOLDOWN_MS = '1';
    process.env.GEMINI_RETRY_BASE_MS = '0';
  });

  afterEach(() => {
    if (originalKeys === undefined) {
      delete process.env.GEMINI_API_KEYS;
    } else {
      process.env.GEMINI_API_KEYS = originalKeys;
    }

    if (originalLegacyKey === undefined) {
      delete process.env.LLM_API_KEY;
    } else {
      process.env.LLM_API_KEY = originalLegacyKey;
    }

    if (originalCooldown === undefined) {
      delete process.env.GEMINI_KEY_COOLDOWN_MS;
    } else {
      process.env.GEMINI_KEY_COOLDOWN_MS = originalCooldown;
    }

    if (originalRetryBase === undefined) {
      delete process.env.GEMINI_RETRY_BASE_MS;
    } else {
      process.env.GEMINI_RETRY_BASE_MS = originalRetryBase;
    }
  });

  it('fails over to the next key on quota errors', async () => {
    const pool = new GeminiKeyPool();

    const result = await pool.withClient(async (client) => {
      if ((client as { apiKey: string }).apiKey === 'key-a') {
        const error = new Error('RESOURCE_EXHAUSTED');
        (error as Error & { status?: number }).status = 429;
        throw error;
      }

      return (client as { apiKey: string }).apiKey;
    });

    expect(result).toBe('key-b');
  });

  it('does not mask auth errors with key rotation', async () => {
    const pool = new GeminiKeyPool();

    await expect(
      pool.withClient(async () => {
        const error = new Error('Invalid API key');
        (error as Error & { status?: number }).status = 401;
        throw error;
      })
    ).rejects.toMatchObject({ message: 'Invalid API key' });
  });

  it('falls back to the legacy single key env var', async () => {
    delete process.env.GEMINI_API_KEYS;
    process.env.LLM_API_KEY = 'legacy-key';
    const pool = new GeminiKeyPool();

    const result = await pool.withClient(async (client) => (client as { apiKey: string }).apiKey);

    expect(result).toBe('legacy-key');
  });
});
