/**
 * Participant in the Secret Santa exchange
 */
export interface Participant {
  name: string;
  email: string;
  description: string;
}

/**
 * Assignment of a gift giver to a gift receiver
 */
export interface Assignment {
  gifter: Participant;
  giftee: Participant;
}

/**
 * Configuration loaded from files
 */
export interface Config {
  participants: Participant[];
}

/**
 * Generated AI content for an assignment
 */
export interface AIContent {
  message: string;
  imageUrl?: string;
  imageBuffer?: Buffer;
}

/**
 * Email data to be sent
 */
export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    cid: string;
  }>;
}

/**
 * Service interfaces for dependency injection
 */
export interface ISecretSantaAlgorithm {
  assign(participants: Participant[]): Assignment[];
}

export interface ILlmService {
  generateMessage(gifterName: string, gifteeName: string, gifteeDescription: string): Promise<string>;
}

export interface IImageService {
  generateImage(gifteeDescription: string): Promise<Buffer>;
}

export interface IEmailService {
  sendEmail(emailData: EmailData): Promise<void>;
  sendSecretSantaEmail(
    gifter: Participant,
    giftee: Participant,
    message: string,
    imageBuffer?: Buffer
  ): Promise<void>;
}

export interface IConfigLoader {
  loadConfig(): Config;
}

/**
 * Options for running the Secret Santa application
 */
export interface SecretSantaOptions {
  dryRun?: boolean;
}

/**
 * SendGrid email service configuration
 */
export interface SendGridConfig {
  apiKey: string;
  from: string;
}
