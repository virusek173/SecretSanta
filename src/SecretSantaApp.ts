import * as fs from 'fs';
import * as path from 'path';
import { SecretSantaAlgorithm } from './algorithm/secretSanta';
import { ConfigLoader } from './config/loadConfig';
import { LlmService } from './services/LlmService';
import { ImageService } from './services/ImageService';
import { EmailService } from './services/EmailService';
import { Assignment, Participant, SendGridConfig } from './types';

/**
 * Main Secret Santa application
 */
export class SecretSantaApp {
  private algorithm: SecretSantaAlgorithm;
  private configLoader: ConfigLoader;
  private llmService: LlmService;
  private imageService: ImageService;
  private emailService: EmailService | null;
  private isDryRun: boolean;
  private shouldSkipImages: boolean;
  private outputDir: string;

  constructor(isDryRun: boolean = false, shouldSkipImages: boolean = false) {
    this.isDryRun = isDryRun;
    this.shouldSkipImages = shouldSkipImages;
    this.outputDir = path.join(process.cwd(), 'output');
    this.algorithm = new SecretSantaAlgorithm();
    this.configLoader = new ConfigLoader();

    this.validateEnv();

    const openaiApiKey = process.env.OPENAI_API_KEY!;
    this.llmService = new LlmService(openaiApiKey);
    this.imageService = new ImageService(openaiApiKey);

    this.emailService = isDryRun ? null : this.createEmailService();
  }

  private validateEnv(): void {
    const required = ['OPENAI_API_KEY'];

    if (!this.isDryRun) {
      required.push('SENDGRID_API_KEY', 'SENDGRID_FROM');
    }

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}\n` +
        'Please check your .env file.'
      );
    }
  }

  private createEmailService(): EmailService {
    const sendGridConfig: SendGridConfig = {
      apiKey: process.env.SENDGRID_API_KEY!,
      from: process.env.SENDGRID_FROM!,
    };
    return new EmailService(sendGridConfig);
  }

  async run(): Promise<void> {
    this.printHeader();

    try {
      if (this.isDryRun) {
        this.prepareOutputDirectory();
      }

      const config = this.loadConfiguration();
      await this.verifySmtpIfNeeded();
      const assignments = this.performAssignment(config.participants);
      await this.processAllAssignments(assignments);

      this.printSuccess();
    } catch (error) {
      console.error('\n❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private prepareOutputDirectory(): void {
    if (fs.existsSync(this.outputDir)) {
      // Clean existing output directory
      fs.rmSync(this.outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(this.outputDir, { recursive: true });
    console.log(`📁 Output directory prepared: ${this.outputDir}\n`);
  }

  private printHeader(): void {
    console.log('🎅 Secret Santa Application');
    console.log('═'.repeat(50));
    if (this.isDryRun) {
      console.log('⚠️  DRY RUN MODE - No emails will be sent');
    }
    if (this.shouldSkipImages) {
      console.log('⚠️  SKIP IMAGES MODE - No images will be generated');
    }
    if (this.isDryRun || this.shouldSkipImages) {
      console.log('');
    }
  }

  private loadConfiguration() {
    console.log('📂 Loading configuration...');
    const config = this.configLoader.loadConfig();
    console.log(`✓ Loaded ${config.participants.length} participants\n`);
    return config;
  }

  private async verifySmtpIfNeeded(): Promise<void> {
    if (this.emailService) {
      console.log('📧 Verifying SendGrid connection...');
      await this.emailService.verifyConnection();
      console.log('✓ SendGrid connection successful\n');
    }
  }

  private performAssignment(participants: Participant[]) {
    console.log('🎲 Performing Secret Santa assignment...');
    const assignments = this.algorithm.assign(participants);
    console.log(`✓ Created ${assignments.length} assignments\n`);
    return assignments;
  }

  private async processAllAssignments(assignments: Assignment[]): Promise<void> {
    console.log('📨 Processing assignments...\n');

    for (let i = 0; i < assignments.length; i++) {
      await this.processAssignment(assignments[i], i + 1, assignments.length);

      if (i < assignments.length - 1) {
        await this.delayBetweenRequests();
      }
    }
  }

  private async processAssignment(
    assignment: Assignment,
    index: number,
    total: number
  ): Promise<void> {
    const { gifter, giftee } = assignment;
    console.log(`[${index}/${total}] Processing ${gifter.name} → ${giftee.name}`);

    const message = await this.generateMessage(gifter.name, giftee.name, giftee.description);
    const imageBuffer = this.shouldSkipImages ? Buffer.alloc(0) : await this.generateImage(giftee.description);

    await this.sendOrPreview(gifter, giftee, message, imageBuffer);
  }

  private async generateMessage(
    gifterName: string,
    gifteeName: string,
    description: string
  ): Promise<string> {
    console.log(`   🤖 Generating message...`);
    const message = await this.llmService.generateMessage(gifterName, gifteeName, description);
    console.log(`   ✓ Message generated`);
    return message;
  }

  private async generateImage(description: string): Promise<Buffer> {
    if (this.shouldSkipImages) {
      console.log(`   🎨 Skipping image generation...`);
      return Buffer.alloc(0);
    }
    console.log(`   🎨 Generating image...`);
    const imageBuffer = await this.imageService.generateImage(description);
    console.log(`   ✓ Image generated`);
    return imageBuffer;
  }

  private async sendOrPreview(
    gifter: Participant,
    giftee: Participant,
    message: string,
    imageBuffer: Buffer
  ): Promise<void> {
    if (this.isDryRun) {
      await this.saveToFiles(gifter, giftee, message, imageBuffer);
    } else {
      await this.sendEmail(gifter, giftee, message, imageBuffer);
    }
  }

  private async saveToFiles(
    gifter: Participant,
    giftee: Participant,
    message: string,
    imageBuffer: Buffer
  ): Promise<void> {
    const sanitizedName = gifter.name.replace(/[^a-z0-9]/gi, '_');

    // Save message to text file
    const messageFileName = `${sanitizedName}_message.txt`;
    const messageFilePath = path.join(this.outputDir, messageFileName);
    const messageContent = `Od: ${gifter.name} <${gifter.email}>
Do: Uczestnik Secret Santa
Temat: Twoje losowanie Secret Santa

Cześć ${gifter.name},

Wylosowałeś/-aś: ${giftee.name}

${message}

---
Wygenerowano: ${new Date().toLocaleString()}
`;

    fs.writeFileSync(messageFilePath, messageContent, 'utf-8');

    console.log(`   💾 [DRY RUN] Saved to files:`);
    console.log(`       Message: ${messageFileName}`);

    // Save image only if not skipped
    if (!this.shouldSkipImages && imageBuffer.length > 0) {
      const imageFileName = `${sanitizedName}_image.png`;
      const imageFilePath = path.join(this.outputDir, imageFileName);
      fs.writeFileSync(imageFilePath, imageBuffer);
      console.log(`       Image: ${imageFileName}`);
    }

    console.log(`   📝 Message preview:\n${this.formatMessage(message)}`);
  }

  private async sendEmail(
    gifter: Participant,
    giftee: Participant,
    message: string,
    imageBuffer: Buffer
  ): Promise<void> {
    console.log(`   📧 Sending email to ${gifter.email}...`);
    await this.emailService!.sendSecretSantaEmail(gifter, giftee, message, imageBuffer);
    console.log(`   ✓ Email sent successfully`);
  }

  private formatMessage(message: string): string {
    return message
      .split('\n')
      .map(line => `       ${line}`)
      .join('\n');
  }

  private async delayBetweenRequests(): Promise<void> {
    const delayMs = 2000;
    console.log(`   ⏳ Waiting ${delayMs / 1000}s before next request...\n`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  private printSuccess(): void {
    console.log('═'.repeat(50));
    console.log('✅ Secret Santa completed successfully!');
    if (this.isDryRun) {
      console.log('   (Dry run - no emails were sent)');
    }
    console.log('═'.repeat(50));
  }
}
