import sgClient from '@sendgrid/client';
import { EmailService } from '../../services/EmailService';

jest.mock('@sendgrid/client', () => ({
  __esModule: true,
  default: { setApiKey: jest.fn(), request: jest.fn() },
}));
jest.mock('@sendgrid/mail', () => ({
  __esModule: true,
  default: { setApiKey: jest.fn(), send: jest.fn() },
}));

const request = sgClient.request as jest.Mock;

describe('EmailService.verifyConnection', () => {
  const service = new EmailService({ apiKey: 'SG.test', from: 'santa@example.com' });

  beforeEach(() => request.mockReset());

  it('passes when the key has mail.send scope', async () => {
    request.mockResolvedValue([{}, { scopes: ['mail.send', 'user.profile.read'] }]);
    await expect(service.verifyConnection()).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledWith({ method: 'GET', url: '/v3/scopes' });
  });

  it('fails when the key lacks mail.send scope', async () => {
    request.mockResolvedValue([{}, { scopes: ['user.profile.read'] }]);
    await expect(service.verifyConnection()).rejects.toThrow('lacks the "mail.send" permission');
  });

  it('reports an invalid key on 401', async () => {
    request.mockRejectedValue(Object.assign(new Error('Unauthorized'), { code: 401 }));
    await expect(service.verifyConnection()).rejects.toThrow('API key is invalid or revoked');
  });
});
