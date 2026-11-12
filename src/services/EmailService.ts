import sgClient from '@sendgrid/client';
import sgMail from '@sendgrid/mail';
import { IEmailService, EmailData, GeneratedImage, Participant, SendGridConfig } from '../types';
import { EMAIL_SUBJECT, renderHtmlEmail, renderTextEmail } from './emailTemplates';

const IMAGE_CID = 'christmas-image';

/**
 * Service for sending emails via SendGrid
 */
export class EmailService implements IEmailService {
  private fromAddress: string;

  constructor(config: SendGridConfig) {
    this.validateConfig(config);
    sgMail.setApiKey(config.apiKey);
    sgClient.setApiKey(config.apiKey);
    this.fromAddress = config.from;
  }

  /**
   * Validate SendGrid configuration
   */
  private validateConfig(config: SendGridConfig): void {
    if (!config.apiKey) {
      throw new Error('SendGrid API key is required');
    }
    if (!config.from) {
      throw new Error('From address is required');
    }
  }

  /**
   * Send an email
   */
  async sendEmail(emailData: EmailData): Promise<void> {
    try {
      const msg: sgMail.MailDataRequired = {
        to: emailData.to,
        from: {
          email: this.fromAddress,
          name: 'Święty Mikołaj',
        },
        replyTo: this.fromAddress,
        subject: emailData.subject,
        html: emailData.html,
        // Plain text version improves deliverability
        text: emailData.text || stripHtml(emailData.html),
        // Category helps with tracking and reputation
        categories: ['secret-santa', 'event-notification'],
        // Custom headers to improve deliverability
        headers: {
          'X-Entity-Ref-ID': `secret-santa-${Date.now()}`,
          'List-Unsubscribe': `<mailto:${this.fromAddress}?subject=unsubscribe>`,
        },
        // Mail settings to improve deliverability
        mailSettings: {
          bypassListManagement: { enable: false },
          footer: { enable: false },
          sandboxMode: { enable: false },
        },
        trackingSettings: {
          clickTracking: { enable: false, enableText: false },
          openTracking: { enable: false },
          subscriptionTracking: { enable: false },
        },
        attachments: emailData.attachments && emailData.attachments.length > 0
          ? emailData.attachments.map(att => ({
            content: att.content.toString('base64'),
            filename: att.filename,
            type: att.contentType,
            disposition: 'inline',
            content_id: att.cid,
          }))
          : undefined,
      };

      await sgMail.send(msg);
    } catch (error: unknown) {
      // Log detailed error information from SendGrid
      if (error && typeof error === 'object' && 'response' in error) {
        const sgError = error as { response?: { body: unknown }; code?: string };
        if (sgError.response) {
          console.error('\n❌ SendGrid Error Details:');
          console.error('Status:', sgError.code);
          console.error('Response:', JSON.stringify(sgError.response.body, null, 2));
        }
      }

      const reason = error instanceof Error ? error.message : 'Unknown error';
      // Keep the HTTP status so callers can decide whether to retry
      const status = (error as { code?: unknown })?.code;
      throw Object.assign(new Error(`Failed to send email to ${emailData.to}: ${reason}`), {
        status: typeof status === 'number' ? status : undefined,
      });
    }
  }

  /**
   * Send Secret Santa email with personalized message and optional inline image
   */
  async sendSecretSantaEmail(
    gifter: Participant,
    giftee: Participant,
    message: string,
    image?: GeneratedImage
  ): Promise<void> {
    const hasImage = !!(image && image.data.length > 0);
    const templateInput = {
      gifterName: gifter.name,
      gifteeName: giftee.name,
      message,
      imageCid: hasImage ? IMAGE_CID : undefined,
    };

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
    });
  }

  /**
   * Verify the SendGrid API key is valid and allowed to send mail.
   * Calls GET /v3/scopes, which works for any valid key.
   */
  async verifyConnection(): Promise<void> {
    let scopes: string[];
    try {
      const [, body] = await sgClient.request({ method: 'GET', url: '/v3/scopes' });
      scopes = (body as { scopes?: string[] })?.scopes ?? [];
    } catch (error) {
      const status = (error as { code?: number })?.code;
      const reason = status === 401 || status === 403
        ? 'API key is invalid or revoked'
        : error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`SendGrid connection failed: ${reason}`);
    }

    if (!scopes.includes('mail.send')) {
      throw new Error('SendGrid connection failed: API key lacks the "mail.send" permission');
    }
  }
}

/**
 * Strip HTML tags for plain text fallback
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
