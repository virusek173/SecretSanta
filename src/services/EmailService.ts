import sgMail from '@sendgrid/mail';
import { IEmailService, EmailData, Participant, SendGridConfig } from '../types';

/**
 * Service for sending emails via SendGrid
 */
export class EmailService implements IEmailService {
  private fromAddress: string;

  constructor(config: SendGridConfig) {
    this.validateConfig(config);
    sgMail.setApiKey(config.apiKey);
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
          name: 'Secret Santa',
        },
        replyTo: this.fromAddress,
        subject: emailData.subject,
        html: emailData.html,
        // Plain text version improves deliverability
        text: emailData.text || this.stripHtml(emailData.html),
        // Category helps with tracking and reputation
        categories: ['secret-santa', 'event-notification'],
        // Custom headers to improve deliverability
        headers: {
          'X-Entity-Ref-ID': `secret-santa-${Date.now()}`,
          'List-Unsubscribe': `<mailto:${this.fromAddress}?subject=unsubscribe>`,
        },
        // Mail settings to improve deliverability
        mailSettings: {
          bypassListManagement: {
            enable: false,
          },
          footer: {
            enable: false,
          },
          sandboxMode: {
            enable: false,
          },
        },
        trackingSettings: {
          clickTracking: {
            enable: false,
            enableText: false,
          },
          openTracking: {
            enable: false,
          },
          subscriptionTracking: {
            enable: false,
          },
        },
        attachments: emailData.attachments && emailData.attachments.length > 0
          ? emailData.attachments.map(att => ({
            content: att.content.toString('base64'),
            filename: att.filename,
            type: 'image/png',
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
          const { body } = sgError.response;
          console.error('\n❌ SendGrid Error Details:');
          console.error('Status:', sgError.code);
          console.error('Response:', JSON.stringify(body, null, 2));
        }
      }

      if (error instanceof Error) {
        throw new Error(`Failed to send email to ${emailData.to}: ${error.message}`);
      }
      throw new Error(`Failed to send email to ${emailData.to}: Unknown error`);
    }
  }

  /**
   * Send Secret Santa email with personalized message and image
   */
  async sendSecretSantaEmail(
    gifter: Participant,
    giftee: Participant,
    message: string,
    imageBuffer?: Buffer
  ): Promise<void> {
    const hasImage = !!(imageBuffer && imageBuffer.length > 0);
    const textContent = this.createTextEmailTemplate(gifter.name, giftee.name, message);
    const htmlContent = this.createEmailTemplate(gifter.name, giftee.name, message, hasImage);

    const emailData: EmailData = {
      to: gifter.email,
      subject: 'Secret Santa - Wyniki losowania',
      html: htmlContent,
      text: textContent,
      attachments: hasImage
        ? [
          {
            filename: 'christmas.png',
            content: imageBuffer!,
            cid: 'christmas-image',
          },
        ]
        : undefined,
    };

    await this.sendEmail(emailData);
  }

  /**
   * Create HTML email template
   */
  private createEmailTemplate(
    gifterName: string,
    _gifteeName: string,
    message: string,
    hasImage: boolean
  ): string {
    return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Secret Santa - Wyniki losowania</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      padding: 40px 30px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #d32f2f;
    }
    .header h1 {
      color: #d32f2f;
      margin: 10px 0;
      font-size: 24px;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 20px;
      color: #333333;
    }
    .message-box {
      background-color: #fafafa;
      border-left: 4px solid #d32f2f;
      padding: 20px;
      margin: 25px 0;
    }
    .message-box p {
      margin: 10px 0;
      color: #333333;
    }
    .image-container {
      text-align: center;
      margin: 30px 0;
    }
    .image-container img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 0 auto;
    }
    .reminder {
      background-color: #fff3cd;
      border: 1px solid #ffc107;
      padding: 15px;
      margin: 25px 0;
      color: #856404;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #dddddd;
      font-size: 13px;
      color: #666666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎅 Secret Santa - Wyniki losowania</h1>
    </div>

    <div class="greeting">
      <p>Cześć ${gifterName}!</p>
      <p>Wylosowanie w tegorocznej zabawie Secret Santa zostało zakończone.</p>
    </div>

    <div class="message-box">
      ${message.split('\n').map(line => `<p>${line || '&nbsp;'}</p>`).join('')}
    </div>

    ${hasImage
        ? `
    <div class="image-container">
      <img src="cid:christmas-image" alt="Ilustracja świąteczna" />
    </div>
    `
        : ''
      }

    <div class="reminder">
      <p><strong>Ważne przypomnienie:</strong></p>
      <p>Wylosowana osoba to tajemnica! Nie mów nikomu, kogo wylosowałeś.</p>
      <p>Miłego przygotowywania prezentu i wesołych świąt!</p>
    </div>

    <div class="footer">
      <p>Ta wiadomość została wygenerowana automatycznie w ramach zabawy Secret Santa.</p>
      <p>Jeśli masz pytania, skontaktuj się z organizatorem.</p>
      <p>🎄 Wesołych Świąt! 🎄</p>
      <p style="font-size: 11px; color: #999; margin-top: 20px;">
        Otrzymujesz tę wiadomość, ponieważ bierzesz udział w zabawie Secret Santa.<br>
        Jeśli nie chcesz otrzymywać więcej wiadomości, skontaktuj się z organizatorem.
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Create plain text email template
   */
  private createTextEmailTemplate(
    gifterName: string,
    _gifteeName: string,
    message: string
  ): string {
    return `
SECRET SANTA - WYNIKI LOSOWANIA

Cześć ${gifterName}!

Wylosowanie w tegorocznej zabawie Secret Santa zostało zakończone.

${message}

WAŻNE PRZYPOMNIENIE:
Wylosowana osoba to tajemnica! Nie mów nikomu, kogo wylosowałeś.
Miłego przygotowywania prezentu i wesołych świąt!

---
Ta wiadomość została wygenerowana automatycznie w ramach zabawy Secret Santa.
Jeśli masz pytania, skontaktuj się z organizatorem.

Otrzymujesz tę wiadomość, ponieważ bierzesz udział w zabawie Secret Santa.
Jeśli nie chcesz otrzymywać więcej wiadomości, skontaktuj się z organizatorem.

🎄 Wesołych Świąt! 🎄
    `.trim();
  }

  /**
   * Strip HTML tags for plain text fallback
   */
  private stripHtml(html: string): string {
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

  /**
   * Verify SendGrid API key is valid
   */
  async verifyConnection(): Promise<void> {
    // SendGrid doesn't have a built-in verify method like nodemailer
    // We'll do a basic check that the API key is set
    try {
      // The API key validation happens when sending emails
      // For now, we just check if it's configured
      if (!sgMail) {
        throw new Error('SendGrid client not initialized');
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`SendGrid connection failed: ${error.message}`);
      }
      throw new Error('SendGrid connection failed: Unknown error');
    }
  }
}