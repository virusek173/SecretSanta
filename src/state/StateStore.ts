import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { DrawState, Participant } from '../types';

const STATE_FILE = 'draw.enc';
const KEY_FILE = 'draw.key';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Persists the draw between runs so an interrupted run can be resumed
 * without re-drawing.
 *
 * The state is encrypted with AES-256-GCM using a random key stored next
 * to it. This does not stop a determined organizer, but it keeps the pairs
 * out of sight: nobody sees them by opening a file, and the whole
 * directory is deleted once every email has been sent.
 */
export class StateStore {
  private readonly dir: string;

  constructor(dir: string = path.join(process.cwd(), 'state')) {
    this.dir = dir;
  }

  exists(): boolean {
    return fs.existsSync(path.join(this.dir, STATE_FILE));
  }

  save(state: DrawState): void {
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    const key = this.loadOrCreateKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(state), 'utf-8'), cipher.final()]);
    const payload = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);

    // Write atomically so a crash never leaves a half-written state file
    const target = path.join(this.dir, STATE_FILE);
    const tmp = `${target}.tmp`;
    fs.writeFileSync(tmp, payload, { mode: 0o600 });
    fs.renameSync(tmp, target);
  }

  load(): DrawState {
    const keyPath = path.join(this.dir, KEY_FILE);
    if (!fs.existsSync(keyPath)) {
      throw new Error(`State key not found: ${keyPath}`);
    }
    const key = fs.readFileSync(keyPath);
    const payload = fs.readFileSync(path.join(this.dir, STATE_FILE));

    try {
      const iv = payload.subarray(0, IV_LENGTH);
      const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
      const ciphertext = payload.subarray(IV_LENGTH + TAG_LENGTH);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const json = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8');
      return JSON.parse(json) as DrawState;
    } catch {
      throw new Error('Saved draw state is corrupted or the key does not match');
    }
  }

  clear(): void {
    fs.rmSync(this.dir, { recursive: true, force: true });
  }

  private loadOrCreateKey(): Buffer {
    const keyPath = path.join(this.dir, KEY_FILE);
    if (fs.existsSync(keyPath)) {
      return fs.readFileSync(keyPath);
    }
    const key = crypto.randomBytes(32);
    fs.writeFileSync(keyPath, key, { mode: 0o600 });
    return key;
  }
}

/**
 * Fingerprint of the participant list, used to refuse resuming a draw
 * after participants.json has changed.
 */
export function participantsFingerprint(participants: Participant[]): string {
  return crypto.createHash('sha256').update(JSON.stringify(participants)).digest('hex');
}
