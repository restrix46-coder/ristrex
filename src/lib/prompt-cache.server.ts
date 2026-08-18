import { getSql } from '@/lib/db';

export const PROMPT_CACHE_MIGRATION = `
CREATE TABLE IF NOT EXISTS prompt_cache (
  key TEXT PRIMARY KEY,
  model TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  output_text TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_usd REAL NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  embeddings_hash TEXT
);
`;

export interface CacheEntry {
  key: string;
  model: string;
  inputHash: string;
  outputText: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  createdAt: Date;
  expiresAt: Date;
  hitCount: number;
}

const memoryCache = new Map<string, CacheEntry>();
const MEMORY_CACHE_MAX_SIZE = 500;
const MEMORY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let stats = {
  memoryHits: 0,
  dbHits: 0,
  misses: 0,
  savedCostUsd: 0,
};

async function generateHash(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Retrieves a cached prompt result
 * @param model Model name
 * @param system System prompt
 * @param content User content
 */
export async function getCached(model: string, system: string, content: string): Promise<CacheEntry | null> {
  const inputString = `${model}:${system}:${content}`;
  const key = await generateHash(inputString);
  
  const memEntry = memoryCache.get(key);
  if (memEntry && memEntry.expiresAt.getTime() > Date.now()) {
    memEntry.hitCount++;
    stats.memoryHits++;
    stats.savedCostUsd += memEntry.costUsd;
    return memEntry;
  }

  const sql = getSql();
  const [dbRow] = await sql`
    SELECT * FROM prompt_cache WHERE key = ${key} AND expires_at > CURRENT_TIMESTAMP
  `;

  if (dbRow) {
    const entry: CacheEntry = {
      key: dbRow.key,
      model: dbRow.model,
      inputHash: dbRow.input_hash,
      outputText: dbRow.output_text,
      inputTokens: dbRow.input_tokens,
      outputTokens: dbRow.output_tokens,
      costUsd: dbRow.cost_usd,
      createdAt: dbRow.created_at,
      expiresAt: dbRow.expires_at,
      hitCount: dbRow.hit_count + 1
    };
    
    await sql`UPDATE prompt_cache SET hit_count = hit_count + 1 WHERE key = ${key}`;
    
    memoryCache.set(key, entry);
    stats.dbHits++;
    stats.savedCostUsd += entry.costUsd;
    return entry;
  }

  stats.misses++;
  return null;
}

/**
 * Saves a prompt result to cache
 * @param model Model name
 * @param system System prompt
 * @param content User content
 * @param result Cache contents
 */
export async function setCached(
  model: string, 
  system: string, 
  content: string, 
  result: Omit<CacheEntry, 'key' | 'inputHash' | 'createdAt' | 'expiresAt' | 'hitCount'>
): Promise<void> {
  const inputString = `${model}:${system}:${content}`;
  const key = await generateHash(inputString);
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours DB TTL
  const memExpiresAt = new Date(now.getTime() + MEMORY_CACHE_TTL_MS);

  const entry: CacheEntry = {
    ...result,
    key,
    inputHash: key,
    createdAt: now,
    expiresAt: memExpiresAt,
    hitCount: 0
  };

  if (memoryCache.size >= MEMORY_CACHE_MAX_SIZE) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, entry);

  const sql = getSql();
  await sql`
    INSERT INTO prompt_cache (
      key, model, input_hash, output_text, input_tokens, output_tokens, cost_usd, expires_at
    ) VALUES (
      ${key}, ${result.model}, ${key}, ${result.outputText}, ${result.inputTokens}, ${result.outputTokens}, ${result.costUsd}, ${expiresAt}
    ) ON CONFLICT (key) DO UPDATE SET
      output_text = EXCLUDED.output_text,
      expires_at = EXCLUDED.expires_at
  `;
}

/**
 * Clears cache
 * @param pattern Optional match pattern
 */
export async function invalidateCache(pattern?: string): Promise<void> {
  memoryCache.clear();
  const sql = getSql();
  if (pattern) {
    await sql`DELETE FROM prompt_cache WHERE key LIKE ${'%' + pattern + '%'}`;
  } else {
    await sql`DELETE FROM prompt_cache`;
  }
}

/**
 * Returns cache statistics
 */
export function getCacheStats() {
  const total = stats.memoryHits + stats.dbHits + stats.misses;
  return {
    ...stats,
    hitRate: total > 0 ? (stats.memoryHits + stats.dbHits) / total : 0
  };
}
