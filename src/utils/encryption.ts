import * as crypto from 'crypto';

/**
 * Utility for encrypting/masking sensitive information in logs
 */
export class LogEncryption {
  private key: string;
  private cache: Map<string, string>;

  constructor(secretKey?: string) {
    // Use provided key or generate a session-specific one
    this.key = secretKey || crypto.randomBytes(32).toString('hex');
    this.cache = new Map();
  }

  /**
   * Encrypts a name for logging purposes
   * Uses consistent hashing so the same name always produces the same output
   */
  encryptName(name: string): string {
    if (!name) return '[EMPTY]';

    // Check cache first
    if (this.cache.has(name)) {
      return this.cache.get(name)!;
    }

    // Create a consistent hash of the name using the key
    const hash = crypto
      .createHmac('sha256', this.key)
      .update(name)
      .digest('hex')
      .substring(0, 8)
      .toUpperCase();

    const encrypted = `[USER-${hash}]`;
    this.cache.set(name, encrypted);

    return encrypted;
  }

  /**
   * Encrypts email for logging purposes
   */
  encryptEmail(email: string): string {
    if (!email) return '[EMPTY]';

    const hash = crypto
      .createHmac('sha256', this.key)
      .update(email)
      .digest('hex')
      .substring(0, 8)
      .toLowerCase();

    return `***@${hash}.masked`;
  }

  /**
   * Get mapping of original names to encrypted names (for reference)
   */
  getMapping(): Record<string, string> {
    const mapping: Record<string, string> = {};
    this.cache.forEach((encrypted, original) => {
      mapping[original] = encrypted;
    });
    return mapping;
  }
}
