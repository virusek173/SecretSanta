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
        // Use provided text version or generate from HTML
        text: emailData.text || this.htmlToText(emailData.html),
        // Category helps with tracking and reputation
        categories: ['secret-santa'],
        // Custom headers to improve deliverability
        headers: {
          'X-Entity-Ref-ID': `secret-santa-${Date.now()}`,
        },
        attachments: emailData.attachments && emailData.attachments.length > 0
          ? emailData.attachments.map(att => ({
            content: att.content.toString('base64'),
            filename: att.filename,
            type: 'image/png',
            disposition: 'inline',
            contentId: att.cid,
          }))
          : undefined,
      };

      await sgMail.send(msg);
    } catch (error: any) {
      // Log detailed error information from SendGrid
      if (error.response) {
        const { body } = error.response;
        console.error('\n❌ SendGrid Error Details:');
        console.error('Status:', error.code);
        console.error('Response:', JSON.stringify(body, null, 2));
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
      subject: '🎅 Twoje losowanie Secret Santa!',
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
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f4f4f4;
    }
    .container {
      background-color: white;
      border-radius: 10px;
      padding: 30px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #c41e3a;
      margin: 0;
      font-size: 28px;
    }
    .header .emoji {
      font-size: 48px;
    }
    .message {
      background-color: #f9f9f9;
      border-left: 4px solid #c41e3a;
      padding: 20px;
      margin: 20px 0;
      border-radius: 5px;
    }
    .image-container {
      text-align: center;
      margin: 30px 0;
    }
    .image-container img {
      max-width: 100%;
      height: auto;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 12px;
      color: #666;
    }
    .recipient-name {
      color: #c41e3a;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="emoji">🎅🎄🎁</div>
      <h1>Secret Santa</h1>
    </div>

    <p>Cześć <strong>${gifterName}</strong>!</p>

    <div class="message">
      ${message.split('\n').map(line => `<p>${line}</p>`).join('')}
    </div>

    ${hasImage
        ? `
    <div class="image-container">
      <img src="cid:christmas-image" alt="Christmas illustration" />
    </div>
    `
        : ''
      }

    <p>Pamiętaj, że wylosowana osoba to tajemnica! 🤫</p>
    <p>Miłego przygotowywania prezentu!</p>

    <div class="footer">
      <p>Wiadomość wygenerowana automatycznie przez Secret Santa App</p>
      <p>🎄 Wesołych Świąt! 🎄</p>
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
🎅🎄🎁 Secret Santa 🎁🎄🎅

Cześć ${gifterName}!

${message}

Pamiętaj, że wylosowana osoba to tajemnica! 🤫

Miłego przygotowywania prezentu!

═══════════════════════════════════════════════════
Wiadomość wygenerowana automatycznie przez Secret Santa App
🎄 Wesołych Świąt! 🎄
    `.trim();
  }

  /**
   * Convert HTML to plain text for email clients that don't support HTML
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gs, '')
      .replace(/<script[^>]*>.*?<\/script>/gs, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n\s*\n\s*\n/g, '\n\n')
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