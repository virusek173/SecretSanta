import { createHash } from 'crypto';
import { IEmailService, EmailData, EmailConfig, GeneratedImage, Participant } from '../types';
import { EMAIL_SUBJECT, renderHtmlEmail, renderTextEmail } from './emailTemplates';

const API_URL = 'https://api.resend.com';
const IMAGE_CID = 'christmas-image';
const SENDER_NAME = 'Święty Mikołaj';

/** Resend error names that a retry can't fix */
const PERMANENT_ERRORS = ['daily_quota_exceeded', 'monthly_quota_exceeded'];

type Fetch = typeof fetch;

interface ResendError {
  status: number;
  name?: string;
  message?: string;
}

/**
 * Service for sending emails via Resend (https://resend.com).
 * See docs/decisions/0001-resend-instead-of-sendgrid.md for why not SendGrid.
 */
export class EmailService implements IEmailService {
  private readonly apiKey: string;
  private readonly from: string;
  private readonly fromAddress: string;

  constructor(config: EmailConfig, private readonly fetchFn: Fetch = fetch) {
    if (!config.apiKey) {
      throw new Error('Resend API key is required');
    }
    if (!config.from) {
      throw new Error('From address is required');
    }
    this.apiKey = config.apiKey;
    // Accept both "santa@example.com" and "Name <santa@example.com>"
    this.from = config.from.includes('<') ? config.from : `${SENDER_NAME} <${config.from}>`;
    this.fromAddress = this.from.match(/<([^>]+)>/)?.[1]?.trim() ?? config.from;
  }

  /**
   * Send an email
   */
  async sendEmail(emailData: EmailData, idempotencyKey?: string): Promise<void> {
    const body = {
      from: this.from,
      to: [emailData.to],
      reply_to: this.fromAddress,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
      tags: [{ name: 'app', value: 'secret-santa' }],
      attachments: emailData.attachments?.map(att => ({
        filename: att.filename,
        content: att.content.toString('base64'),
        content_type: att.contentType,
        content_id: att.cid,
      })),
    };

    let error: ResendError | null;
    try {
      error = await this.request('POST', '/emails', body, idempotencyKey);
    } catch (networkError) {
      // No HTTP status: treated as transient by the retry logic
      const reason = networkError instanceof Error ? networkError.message : 'Unknown error';
      throw new Error(`Failed to send email to ${emailData.to}: ${reason}`);
    }

    if (error) {
      console.error(`\n❌ Resend error ${error.status}: ${error.name ?? ''} ${error.message ?? ''}`);
      throw Object.assign(
        new Error(`Failed to send email to ${emailData.to}: ${error.message ?? error.name ?? error.status}`),
        { status: error.status, retryable: !PERMANENT_ERRORS.includes(error.name ?? '') }
      );
    }
  }

  /**
   * Send Secret Santa email with personalized message and optional inline image
   */
  async sendSecretSantaEmail(
    gifter: Participant,
    giftee: Participant,
    message: string,
    image?: GeneratedImage,
    drawCode?: string
  ): Promise<void> {
    const hasImage = !!(image && image.data.length > 0);
    const templateInput = {
      gifterName: gifter.name,
      gifteeName: giftee.name,
      message,
      imageCid: hasImage ? IMAGE_CID : undefined,
      drawCode,
    };

    // Same draw + same recipient = same key, so a retry after a timeout
    // can't deliver the email twice (Resend keeps keys for 24 hours)
    const idempotencyKey = drawCode
      ? createHash('sha256').update(`${drawCode}:${gifter.email}`).digest('hex')
      : undefined;

    await this.sendEmail({
      to: gifter.email,
      subject: EMAIL_SUBJECT,
      html: renderHtmlEmail(templateInput),
      text: renderTextEmail(templateInput),
      attachments: hasImage
        ? [
          {
            filename: `christmas.${image!.extension}`,
            content: image!.data,
            contentType: image!.mimeType,
            cid: IMAGE_CID,
          },
        ]
        : undefined,
    }, idempotencyKey);
  }

  /**
   * Check the API key before drawing. A "Sending access" key can only send,
   * so GET /domains answers restricted_api_key for a valid one. A "Full access"
   * key also lets us check that the sender's domain is verified.
   */
  async verifyConnection(): Promise<void> {
    const response = await this.fetchFn(`${API_URL}/domains`, { headers: this.headers() });
    const payload = await response.json().catch(() => ({}));

    if (response.ok) {
      const domain = this.fromAddress.split('@').pop()?.toLowerCase();
      const domains = (payload as { data?: Array<{ name: string; status: string }> }).data ?? [];
      const match = domains.find(d => d.name.toLowerCase() === domain);
      if (!match) {
        throw new Error(`Resend: domain "${domain}" of the sender address is not added in Resend`);
      }
      if (match.status !== 'verified') {
        throw new Error(`Resend: domain "${domain}" is not verified yet (status: ${match.status})`);
      }
      return;
    }

    if ((payload as { name?: string }).name === 'restricted_api_key') {
      return;
    }
    throw new Error('Resend connection failed: API key is invalid or revoked');
  }

  private headers(idempotencyKey?: string): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    };
  }

  /** Returns null on success, the API error otherwise */
  private async request(
    method: string,
    path: string,
    body: unknown,
    idempotencyKey?: string
  ): Promise<ResendError | null> {
    const response = await this.fetchFn(`${API_URL}${path}`, {
      method,
      headers: this.headers(idempotencyKey),
      body: JSON.stringify(body),
    });
    if (response.ok) {
      return null;
    }
    const payload = await response.json().catch(() => ({})) as { name?: string; message?: string };
    return { status: response.status, name: payload.name, message: payload.message };
  }
}
