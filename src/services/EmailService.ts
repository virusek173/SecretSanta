import nodemailer from 'nodemailer';
import { IEmailService, EmailData, Participant } from '../types';

/**
 * SMTP configuration
 */
export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

/**
 * Service for sending emails
 */
export class EmailService implements IEmailService {
  private transporter: nodemailer.Transporter;
  private fromAddress: string;

  constructor(config: SmtpConfig) {
    this.validateConfig(config);

    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.auth.user,
        pass: config.auth.pass,
      },
    });

    this.fromAddress = config.from;
  }

  /**
   * Validate SMTP configuration
   */
  private validateConfig(config: SmtpConfig): void {
    if (!config.host) {
      throw new Error('SMTP host is required');
    }
    if (!config.port) {
      throw new Error('SMTP port is required');
    }
    if (!config.auth.user) {
      throw new Error('SMTP user is required');
    }
    if (!config.auth.pass) {
      throw new Error('SMTP password is required');
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
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        attachments: emailData.attachments,
      });
    } catch (error) {
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
    const html = this.createEmailTemplate(gifter.name, giftee.name, message, !!imageBuffer);

    const emailData: EmailData = {
      to: gifter.email,
      subject: '🎅 Twoje losowanie Secret Santa!',
      html,
      attachments: imageBuffer
        ? [
            {
              filename: 'christmas.png',
              content: imageBuffer,
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
    gifteeName: string,
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

    ${
      hasImage
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
   * Verify connection to SMTP server
   */
  async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`SMTP connection failed: ${error.message}`);
      }
      throw new Error('SMTP connection failed: Unknown error');
    }
  }
}
