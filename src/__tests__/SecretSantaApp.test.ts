import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SecretSantaApp } from '../SecretSantaApp';
import { StateStore } from '../state/StateStore';
import { Participant } from '../types';

const participants: Participant[] = [
  { name: 'Anna', email: 'anna@example.com', description: 'książki' },
  { name: 'Jan', email: 'jan@example.com', description: 'gitara' },
  { name: 'Maria', email: 'maria@example.com', description: 'joga' },
  { name: 'Piotr', email: 'piotr@example.com', description: 'planszówki' },
];

const mockLoadConfig = jest.fn();
const mockGenerateMessage = jest.fn();
const mockGenerateImage = jest.fn();
const mockSend = jest.fn();
const mockVerify = jest.fn();

jest.mock('../config/loadConfig', () => ({
  ConfigLoader: jest.fn().mockImplementation(() => ({ loadConfig: mockLoadConfig })),
}));
jest.mock('../services/LlmService', () => ({
  LlmService: jest.fn().mockImplementation(() => ({ generateMessage: mockGenerateMessage })),
}));
jest.mock('../services/ImageService', () => ({
  ImageService: jest.fn().mockImplementation(() => ({ generateImage: mockGenerateImage })),
}));
jest.mock('../services/EmailService', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendSecretSantaEmail: mockSend,
    verifyConnection: mockVerify,
  })),
}));

const fast = { generationDelayMs: 0 };

describe('SecretSantaApp', () => {
  let tmp: string;
  let store: StateStore;
  const sentPairs = () => mockSend.mock.calls.map(([gifter, giftee]) => `${gifter.name}->${giftee.name}`);

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'santa-app-'));
    store = new StateStore(path.join(tmp, 'state'));

    process.env.OPENAI_API_KEY = 'test';
    process.env.SENDGRID_API_KEY = 'test';
    process.env.SENDGRID_FROM = 'santa@example.com';

    mockLoadConfig.mockReturnValue({ participants });
    mockGenerateMessage.mockImplementation(async (gifter: string, giftee: string) => `msg ${gifter}->${giftee}`);
    mockGenerateImage.mockResolvedValue({ data: Buffer.from('img'), mimeType: 'image/jpeg', extension: 'jpg' });
    mockSend.mockReset().mockResolvedValue(undefined);
    mockVerify.mockReset().mockResolvedValue(undefined);
    mockGenerateMessage.mockClear();
    mockGenerateImage.mockClear();
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('sends one email per participant and deletes the state', async () => {
    await new SecretSantaApp({ ...fast }, store).run();

    expect(mockSend).toHaveBeenCalledTimes(participants.length);
    expect(store.exists()).toBe(false);
  });

  it('generates all content before sending the first email', async () => {
    mockSend.mockImplementation(async () => {
      expect(mockGenerateMessage).toHaveBeenCalledTimes(participants.length);
      expect(mockGenerateImage).toHaveBeenCalledTimes(participants.length);
    });

    await new SecretSantaApp({ ...fast }, store).run();
  });

  it('keeps progress after a failed send and resumes without re-drawing', async () => {
    mockSend
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(Object.assign(new Error('bad request'), { status: 400 }));

    await expect(new SecretSantaApp({ ...fast }, store).run()).rejects.toThrow('bad request');
    expect(store.exists()).toBe(true);
    const firstPair = sentPairs()[0];
    const savedPairs = store.load().entries.map(e => `${e.gifter.name}->${e.giftee.name}`);

    // A plain run refuses to overwrite the unfinished draw
    await expect(new SecretSantaApp({ ...fast }, store).run()).rejects.toThrow('--resume');

    mockSend.mockReset().mockResolvedValue(undefined);
    mockGenerateMessage.mockClear();
    mockGenerateImage.mockClear();
    await new SecretSantaApp({ ...fast, resume: true }, store).run();

    // Only the unsent emails go out, with the original pairs and content
    expect(mockSend).toHaveBeenCalledTimes(participants.length - 1);
    expect(sentPairs()).not.toContain(firstPair);
    expect([firstPair, ...sentPairs()].sort()).toEqual([...savedPairs].sort());
    expect(mockGenerateMessage).not.toHaveBeenCalled();
    expect(mockGenerateImage).not.toHaveBeenCalled();
    expect(store.exists()).toBe(false);
  });

  it('resumes after a failed generation, keeping finished content', async () => {
    mockGenerateImage
      .mockResolvedValueOnce({ data: Buffer.from('img'), mimeType: 'image/jpeg', extension: 'jpg' })
      .mockRejectedValueOnce(new Error('image api down'));

    await expect(new SecretSantaApp({ ...fast }, store).run()).rejects.toThrow('image api down');
    expect(mockSend).not.toHaveBeenCalled();

    mockGenerateMessage.mockClear();
    mockGenerateImage.mockClear();
    await new SecretSantaApp({ ...fast, resume: true }, store).run();

    // Entry 1 is complete, entry 2 already has its message but not its image
    expect(mockGenerateMessage).toHaveBeenCalledTimes(participants.length - 2);
    expect(mockGenerateImage).toHaveBeenCalledTimes(participants.length - 1);
    expect(mockSend).toHaveBeenCalledTimes(participants.length);
  });

  it('refuses to resume when participants changed', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('bad request'), { status: 400 }));
    await expect(new SecretSantaApp({ ...fast }, store).run()).rejects.toThrow();

    mockLoadConfig.mockReturnValue({ participants: participants.slice(0, 3) });
    await expect(new SecretSantaApp({ ...fast, resume: true }, store).run()).rejects.toThrow('participants.json changed');
  });

  it('starts over with --fresh', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('bad request'), { status: 400 }));
    await expect(new SecretSantaApp({ ...fast }, store).run()).rejects.toThrow();

    mockSend.mockReset().mockResolvedValue(undefined);
    await new SecretSantaApp({ ...fast, fresh: true }, store).run();
    expect(mockSend).toHaveBeenCalledTimes(participants.length);
  });

  it('fails on --resume when there is nothing to resume', async () => {
    await expect(new SecretSantaApp({ ...fast, resume: true }, store).run()).rejects.toThrow('Nothing to resume');
  });

  it('fails before drawing when the SendGrid key is invalid', async () => {
    mockVerify.mockRejectedValue(new Error('SendGrid connection failed'));
    await expect(new SecretSantaApp({ ...fast }, store).run()).rejects.toThrow('SendGrid connection failed');
    expect(store.exists()).toBe(false);
    expect(mockGenerateMessage).not.toHaveBeenCalled();
  });

  it('never logs a gifter next to their giftee', async () => {
    const log = console.log as jest.Mock;
    log.mockClear();
    await new SecretSantaApp({ ...fast }, store).run();

    const output = log.mock.calls.map(args => args.join(' ')).join('\n');
    for (const p of participants) {
      for (const q of participants) {
        expect(output).not.toMatch(new RegExp(`${p.name}.*(→|->).*${q.name}`));
      }
    }
  });
});
