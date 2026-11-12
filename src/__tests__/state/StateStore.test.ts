import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { StateStore, participantsFingerprint } from '../../state/StateStore';
import { DrawState } from '../../types';

describe('StateStore', () => {
  let dir: string;
  let store: StateStore;

  const state: DrawState = {
    version: 1,
    createdAt: '2026-11-12T10:00:00.000Z',
    drawCode: 'AB12',
    participantsFingerprint: 'abc',
    entries: [
      {
        gifter: { name: 'Anna', email: 'anna@example.com', description: 'książki' },
        giftee: { name: 'Jan', email: 'jan@example.com', description: 'gitara' },
        message: 'Wesołych świąt!',
      },
    ],
  };

  beforeEach(() => {
    dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'santa-state-')), 'state');
    store = new StateStore(dir);
  });

  afterEach(() => {
    fs.rmSync(path.dirname(dir), { recursive: true, force: true });
  });

  it('reports no state before the first save', () => {
    expect(store.exists()).toBe(false);
  });

  it('round-trips the state', () => {
    store.save(state);
    expect(store.exists()).toBe(true);
    expect(store.load()).toEqual(state);
  });

  it('does not store names in plain text', () => {
    store.save(state);
    const raw = fs.readFileSync(path.join(dir, 'draw.enc'));
    expect(raw.includes('Anna')).toBe(false);
    expect(raw.includes('Jan')).toBe(false);
  });

  it('rejects a tampered state file', () => {
    store.save(state);
    const file = path.join(dir, 'draw.enc');
    const raw = fs.readFileSync(file);
    raw[raw.length - 1] ^= 0xff;
    fs.writeFileSync(file, raw);
    expect(() => store.load()).toThrow('corrupted');
  });

  it('keeps the same key across saves', () => {
    store.save(state);
    store.save({ ...state, drawCode: 'CD34' });
    expect(new StateStore(dir).load().drawCode).toBe('CD34');
  });

  it('removes everything on clear', () => {
    store.save(state);
    store.clear();
    expect(fs.existsSync(dir)).toBe(false);
  });
});

describe('participantsFingerprint', () => {
  const participants = [{ name: 'Anna', email: 'anna@example.com', description: 'książki' }];

  it('is stable for the same list', () => {
    expect(participantsFingerprint(participants)).toBe(participantsFingerprint([...participants]));
  });

  it('changes when the list changes', () => {
    expect(participantsFingerprint(participants)).not.toBe(
      participantsFingerprint([{ ...participants[0], email: 'other@example.com' }])
    );
  });
});
