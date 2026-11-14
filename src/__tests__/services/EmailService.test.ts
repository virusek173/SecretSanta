import { EmailService } from '../../services/EmailService';
import { isTransientError } from '../../utils/retry';

function reply(status: number, body: unknown = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const anna = { name: 'Anna', email: 'anna@example.com', description: '' };
const jan = { name: 'Jan', email: 'jan@example.com', description: '' };
const image = { data: Buffer.from('jpeg-bytes'), mimeType: 'image/jpeg', extension: 'jpg' };

describe('EmailService', () => {
  let fetchFn: jest.Mock;
  let service: EmailService;

  beforeEach(() => {
    fetchFn = jest.fn().mockResolvedValue(reply(200, { id: 'abc' }));
    service = new EmailService({ apiKey: 're_test', from: 'santa@example.com' }, fetchFn);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  const sentBody = () => JSON.parse(fetchFn.mock.calls[0][1].body);
  const sentHeaders = () => fetchFn.mock.calls[0][1].headers;

  describe('sendSecretSantaEmail', () => {
    it('posts to Resend with the sender name and the inline image', async () => {
      await service.sendSecretSantaEmail(anna, jan, 'Hej', image, '7F3A');

      expect(fetchFn.mock.calls[0][0]).toBe('https://api.resend.com/emails');
      expect(sentHeaders().Authorization).toBe('Bearer re_test');
      const body = sentBody();
      expect(body.from).toBe('Święty Mikołaj <santa@example.com>');
      expect(body.to).toEqual(['anna@example.com']);
      expect(body.reply_to).toBe('santa@example.com');
      expect(body.html).toContain('src="cid:christmas-image"');
      expect(body.html).toContain('Jan');
      expect(body.attachments).toEqual([{
        filename: 'christmas.jpg',
        content: image.data.toString('base64'),
        content_type: 'image/jpeg',
        content_id: 'christmas-image',
      }]);
    });

    it('keeps a sender name given in the from address', async () => {
      service = new EmailService({ apiKey: 're_test', from: 'Mikołaj <m@example.com>' }, fetchFn);
      await service.sendSecretSantaEmail(anna, jan, 'Hej');
      expect(sentBody().from).toBe('Mikołaj <m@example.com>');
      expect(sentBody().reply_to).toBe('m@example.com');
    });

    it('sends no attachments without an image', async () => {
      await service.sendSecretSantaEmail(anna, jan, 'Hej');
      expect(sentBody().attachments).toBeUndefined();
      expect(sentBody().html).not.toContain('cid:');
    });

    it('uses an idempotency key that is stable per draw and recipient and hides the address', async () => {
      await service.sendSecretSantaEmail(anna, jan, 'Hej', undefined, '7F3A');
      await service.sendSecretSantaEmail(anna, jan, 'Hej', undefined, '7F3A');
      await service.sendSecretSantaEmail(anna, jan, 'Hej', undefined, '0000');
      const keys = fetchFn.mock.calls.map(call => call[1].headers['Idempotency-Key']);
      expect(keys[0]).toBe(keys[1]);
      expect(keys[0]).not.toBe(keys[2]);
      expect(keys[0]).not.toContain('anna');
    });
  });

  describe('errors', () => {
    it('keeps the status so rate limits are retried', async () => {
      fetchFn.mockResolvedValue(reply(429, { name: 'rate_limit_exceeded', message: 'Too many requests' }));
      const error = await service.sendSecretSantaEmail(anna, jan, 'Hej').catch(e => e);
      expect(error.message).toContain('Too many requests');
      expect(error.status).toBe(429);
      expect(isTransientError(error)).toBe(true);
    });

    it('does not retry an exhausted quota', async () => {
      fetchFn.mockResolvedValue(reply(429, { name: 'daily_quota_exceeded', message: 'Quota' }));
      const error = await service.sendSecretSantaEmail(anna, jan, 'Hej').catch(e => e);
      expect(isTransientError(error)).toBe(false);
    });

    it('does not retry client errors', async () => {
      fetchFn.mockResolvedValue(reply(403, { name: 'validation_error', message: 'Domain not verified' }));
      const error = await service.sendSecretSantaEmail(anna, jan, 'Hej').catch(e => e);
      expect(isTransientError(error)).toBe(false);
    });

    it('retries network failures', async () => {
      fetchFn.mockRejectedValue(new Error('ECONNRESET'));
      const error = await service.sendSecretSantaEmail(anna, jan, 'Hej').catch(e => e);
      expect(error.message).toContain('ECONNRESET');
      expect(isTransientError(error)).toBe(true);
    });
  });

  describe('verifyConnection', () => {
    it('accepts a sending-only key', async () => {
      fetchFn.mockResolvedValue(reply(401, { name: 'restricted_api_key' }));
      await expect(service.verifyConnection()).resolves.toBeUndefined();
      expect(fetchFn.mock.calls[0][0]).toBe('https://api.resend.com/domains');
    });

    it('rejects an invalid key', async () => {
      fetchFn.mockResolvedValue(reply(400, { name: 'validation_error', message: 'API key is invalid' }));
      await expect(service.verifyConnection()).rejects.toThrow('API key is invalid or revoked');
    });

    it('accepts a full-access key when the sender domain is verified', async () => {
      fetchFn.mockResolvedValue(reply(200, { data: [{ name: 'example.com', status: 'verified' }] }));
      await expect(service.verifyConnection()).resolves.toBeUndefined();
    });

    it('rejects a sender domain that is not verified yet', async () => {
      fetchFn.mockResolvedValue(reply(200, { data: [{ name: 'example.com', status: 'pending' }] }));
      await expect(service.verifyConnection()).rejects.toThrow('not verified yet (status: pending)');
    });

    it('rejects a sender domain missing from Resend', async () => {
      fetchFn.mockResolvedValue(reply(200, { data: [{ name: 'other.com', status: 'verified' }] }));
      await expect(service.verifyConnection()).rejects.toThrow('not added in Resend');
    });
  });
});
