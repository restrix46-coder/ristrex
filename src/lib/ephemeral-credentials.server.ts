import { getSql } from '@/lib/db';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';

export interface EphemeralCredential {
  id: string;
  type: 'api_key' | 'db_password' | 'jwt_token' | 'session_token' | 'service_token';
  value: string;
  issuedTo: string;
  issuedAt: Date;
  expiresAt: Date;
  revoked: boolean;
  rotationCount: number;
  scope: string[];
}

export interface CredentialPolicy {
  type: EphemeralCredential['type'];
  maxAgeSeconds: number;
  rotationIntervalSeconds: number;
  maxUsageCount?: number;
  scopeRestrictions: string[];
}

/**
 * Ephemeral Credentials — short-lived credentials with auto-rotation and revocation.
 */
export class EphemeralCredentialService extends EventEmitter {
  constructor() {
    super();
    this.init();
  }

  private async init() {
    try {
      const sql = await getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS ephemeral_credentials (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          type TEXT NOT NULL,
          value TEXT NOT NULL,
          issued_to TEXT NOT NULL,
          issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          revoked BOOLEAN DEFAULT FALSE,
          rotation_count INT DEFAULT 0,
          scope JSONB
        );
      `;
    } catch (e) {
      console.error('Failed to init EphemeralCredentialService', e);
    }
  }

  public async issue(type: EphemeralCredential['type'], issuedTo: string, scope: string[], maxAgeSeconds: number = 3600): Promise<EphemeralCredential> {
    const value = crypto.randomBytes(32).toString('hex');
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + maxAgeSeconds * 1000);

    const sql = await getSql();
    const rows = await sql`
      INSERT INTO ephemeral_credentials (type, value, issued_to, issued_at, expires_at, scope)
      VALUES (${type}, ${value}, ${issuedTo}, ${issuedAt}, ${expiresAt}, ${JSON.stringify(scope)}::jsonb)
      RETURNING *
    `;

    return this.mapRowToCredential(rows[0]);
  }

  public async validate(credentialId: string): Promise<boolean> {
    const sql = await getSql();
    const rows = await sql`SELECT * FROM ephemeral_credentials WHERE id = ${credentialId}`;
    if (!rows.length) return false;

    const cred = this.mapRowToCredential(rows[0]);
    if (cred.revoked || cred.expiresAt < new Date()) {
      this.emit('SecurityAlert', { message: 'Attempt to use expired or revoked credential', credentialId });
      return false;
    }
    return true;
  }

  public async revoke(credentialId: string, reason: string): Promise<void> {
    const sql = await getSql();
    await sql`UPDATE ephemeral_credentials SET revoked = TRUE WHERE id = ${credentialId}`;
  }

  public async rotate(credentialId: string): Promise<EphemeralCredential | null> {
    const sql = await getSql();
    const rows = await sql`SELECT * FROM ephemeral_credentials WHERE id = ${credentialId}`;
    if (!rows.length) return null;

    const oldCred = this.mapRowToCredential(rows[0]);
    await this.revoke(credentialId, 'Rotated');

    const duration = oldCred.expiresAt.getTime() - oldCred.issuedAt.getTime();
    
    const newValue = crypto.randomBytes(32).toString('hex');
    const newExpiresAt = new Date(Date.now() + duration);

    const newRows = await sql`
      INSERT INTO ephemeral_credentials (type, value, issued_to, expires_at, rotation_count, scope)
      VALUES (${oldCred.type}, ${newValue}, ${oldCred.issuedTo}, ${newExpiresAt}, ${oldCred.rotationCount + 1}, ${JSON.stringify(oldCred.scope)}::jsonb)
      RETURNING *
    `;

    return this.mapRowToCredential(newRows[0]);
  }

  public async revokeAll(issuedTo: string): Promise<void> {
    const sql = await getSql();
    await sql`UPDATE ephemeral_credentials SET revoked = TRUE WHERE issued_to = ${issuedTo}`;
  }

  public async cleanupExpired(): Promise<void> {
    const sql = await getSql();
    await sql`DELETE FROM ephemeral_credentials WHERE expires_at < NOW() AND revoked = TRUE`;
  }

  public async getActive(issuedTo: string): Promise<EphemeralCredential[]> {
    const sql = await getSql();
    const rows = await sql`
      SELECT * FROM ephemeral_credentials 
      WHERE issued_to = ${issuedTo} AND revoked = FALSE AND expires_at > NOW()
    `;
    return rows.map(this.mapRowToCredential);
  }

  private mapRowToCredential(row: any): EphemeralCredential {
    return {
      id: row.id,
      type: row.type,
      value: row.value,
      issuedTo: row.issued_to,
      issuedAt: row.issued_at,
      expiresAt: row.expires_at,
      revoked: row.revoked,
      rotationCount: row.rotation_count,
      scope: typeof row.scope === 'string' ? JSON.parse(row.scope) : row.scope
    };
  }
}

export const ephemeralCredentials = new EphemeralCredentialService();
