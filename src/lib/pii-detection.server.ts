import { getSql } from '@/lib/db';

export type PiiType = 'email' | 'phone' | 'name' | 'address' | 'national_id' | 'credit_card' | 'passport' | 'ip_address' | 'date_of_birth' | 'bank_account';

export interface PiiMatch {
  type: PiiType;
  value: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
}

export const PII_PATTERNS: Record<PiiType, RegExp> = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(?:(?:\+|00)(?:966|971|20|1|44)[-\s]?)?\b(?:\d{9,10})\b/g,
  name: /\b[A-Z][a-z]+ [A-Z][a-z]+\b|[\u0600-\u06FF]{3,} [\u0600-\u06FF]{3,}/g,
  address: /\d+ [\w\s]+(?:St|Ave|Rd|Blvd|Lane|Dr)/gi,
  national_id: /\b\d{10,14}\b/g, // Simplified national ID
  credit_card: /\b(?:\d[ -]*?){13,16}\b/g,
  passport: /\b[A-Z0-9]{8,9}\b/g,
  ip_address: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  date_of_birth: /\b\d{2}[\/\-]\d{2}[\/\-]\d{4}\b/g,
  bank_account: /\b(?:[A-Z]{2}\d{2} ?)(?:\d{4} ?){3,5}\d{1,3}\b/g // IBAN approx
};

/**
 * Detect PII in text
 * @param text The text to scan
 */
export function detectPii(text: string): PiiMatch[] {
  const matches: PiiMatch[] = [];
  
  for (const [type, regex] of Object.entries(PII_PATTERNS)) {
    const matchesIterator = text.matchAll(regex);
    for (const match of matchesIterator) {
      if (match.index !== undefined) {
        matches.push({
          type: type as PiiType,
          value: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          confidence: 0.8
        });
      }
    }
  }
  
  return matches;
}

/**
 * Mask detected PII
 * @param text Original text
 * @param types Optional types to mask
 */
export function maskPii(text: string, types?: PiiType[]): string {
  let maskedText = text;
  const matches = detectPii(text).sort((a, b) => b.startIndex - a.startIndex);
  
  for (const match of matches) {
    if (!types || types.includes(match.type)) {
      const before = maskedText.substring(0, match.startIndex);
      const after = maskedText.substring(match.endIndex);
      maskedText = `${before}[${match.type.toUpperCase()}_REDACTED]${after}`;
    }
  }
  
  return maskedText;
}

/**
 * Sanitize object for logs
 * @param obj Object to sanitize
 */
export function sanitizeForLog(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return maskPii(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForLog);
  }
  if (obj !== null && typeof obj === 'object') {
    const result: any = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = sanitizeForLog(v);
    }
    return result;
  }
  return obj;
}

/**
 * Sanitize text for AI consumption
 * @param text The string to sanitize
 */
export function sanitizeForAI(text: string): string {
  return maskPii(text);
}

/**
 * Create privacy audit log
 * @param action User action
 * @param userId User id
 * @param dataTypes PII types involved
 */
export async function createPrivacyAuditLog(action: string, userId: string, dataTypes: PiiType[]): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO audit_logs (action, user_id, data_types, timestamp)
    VALUES (${action}, ${userId}, ${dataTypes.join(',')}, CURRENT_TIMESTAMP)
  `;
}

export interface DataRetentionPolicy {
  projectId: string;
  maxAgeDays: number;
}

/**
 * Apply retention policy
 * @param projectId Project ID to apply policy to
 */
export async function applyRetentionPolicy(projectId: string): Promise<void> {
  const sql = getSql();
  await sql`
    DELETE FROM user_data 
    WHERE project_id = ${projectId} 
    AND created_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
  `;
}
