import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline/promises';
import { SecretSantaAlgorithm } from './algorithm/SecretSanta';
import { ConfigLoader } from './config/loadConfig';
import { LlmService } from './services/LlmService';
import { ImageService } from './services/ImageService';
import { EmailService } from './services/EmailService';
import { StateStore, participantsFingerprint } from './state/StateStore';
import { LogEncryption } from './utils/encryption';
import { isTransientError, withRetry } from './utils/retry';
import { verifyDraw } from './verification/verifyDraw';
import { DrawEntry, DrawState, GeneratedImage, Participant, SendGridConfig } from './types';

export interface AppOptions {
  /** Generate everything and write it to output/ instead of sending emails */
  dryRun?: boolean;
  /** Skip image generation */
  skipImages?: boolean;
  /** Mask participant names and emails in console output */
  encryptLogs?: boolean;
  /** Continue an interrupted draw instead of starting a new one */
  resume?: boolean;
  /** Pause between participants during generation, to stay under API rate limits */
  generationDelayMs?: number;
  /** Discard an interrupted draw and start a new one */
  fresh?: boolean;
  /** Participants file; defaults to config/participants.json */
  participantsPath?: string;
  /** Send without asking for confirmation after the verification report */
  yes?: boolean;
}

const DEFAULT_GENERATION_DELAY_MS = 1000;

/**
 * Main Secret Santa application.
 *
 * A run has three phases:
 *  1. draw      - assign pairs and persist them (encrypted) in state/
 *  2. generate  - create messages and images, persisting after each one
 *  3. send      - email everyone, marking each successful send
 *
 * If anything fails, `--resume` continues from the last saved point
 * without re-drawing, so emails already sent stay valid.
 * The state is deleted once every email has been sent.
 */
export class SecretSantaApp {
  private algorithm = new SecretSantaAlgorithm();
  private configLoader: ConfigLoader;
  private stateStore: StateStore;
  private llmService: LlmService;
  private imageService: ImageService;
  private emailService: EmailService | null;
  private logEncryption: LogEncryption | null;
  private outputDir = path.join(process.cwd(), 'output');

  constructor(
    private options: AppOptions = {},
    stateStore: StateStore = new StateStore(),
    private confirm: (question: string) => Promise<boolean> = askYesNo
  ) {
    if (options.resume && options.fresh) {
      throw new Error('Use either --resume or --fresh, not both');
    }
    if (options.dryRun && options.resume) {
      throw new Error('--resume cannot be combined with --dry-run');
    }

    this.stateStore = stateStore;
    this.configLoader = new ConfigLoader(options.participantsPath);
    this.logEncryption = options.encryptLogs ? new LogEncryption() : null;

    this.validateEnv();

    const openaiApiKey = process.env.OPENAI_API_KEY!;
    this.llmService = new LlmService(openaiApiKey, process.env.OPENAI_TEXT_MODEL || undefined);
    this.imageService = new ImageService(openaiApiKey, process.env.OPENAI_IMAGE_MODEL || undefined);

    this.emailService = options.dryRun ? null : this.createEmailService();
  }

  private validateEnv(): void {
    const required = ['OPENAI_API_KEY'];

    if (!this.options.dryRun) {
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
    let drawLoaded = false;

    try {
      const participants = this.loadParticipants();

      if (this.emailService) {
        console.log('📧 Verifying SendGrid API key...');
        await this.emailService.verifyConnection();
        console.log('✓ SendGrid API key is valid\n');
      }

      const state = this.options.dryRun
        ? this.createDraw(participants)
        : this.loadOrCreateDraw(participants);
      drawLoaded = true;

      this.printVerificationReport(state, participants);

      if (!this.options.dryRun && !(await this.confirmSending(state))) {
        console.log('\n🛑 Stopped before generating or sending anything.');
        console.log('   Continue this draw: npm run santa:resume  ·  Draw again: npm run santa:fresh');
        return;
      }

      await this.generateContent(state);

      if (this.options.dryRun) {
        this.writePreview(state);
      } else {
        await this.sendAll(state);
        this.stateStore.clear();
      }

      this.printSuccess();
    } catch (error) {
      console.error('\n❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      if (drawLoaded && !this.options.dryRun && this.stateStore.exists()) {
        console.error('   Progress is saved. Fix the problem, then continue with: npm run santa:resume');
      }
      throw error;
    }
  }

  private printHeader(): void {
    console.log('🎅 Secret Santa Application');
    console.log('═'.repeat(50));
    if (this.options.dryRun) {
      console.log('⚠️  DRY RUN MODE - No emails will be sent');
      console.log('⚠️  The preview in output/ reveals every pair - don\'t open it if you take part!');
    }
    if (this.options.skipImages) {
      console.log('⚠️  SKIP IMAGES MODE - No images will be generated');
    }
    if (this.options.encryptLogs) {
      console.log('🔒 ENCRYPTED LOGS MODE - Names will be masked in logs');
    }
    console.log('');
  }

  private loadParticipants(): Participant[] {
    console.log('📂 Loading configuration...');
    const { participants } = this.configLoader.loadConfig();
    console.log(`✓ Loaded ${participants.length} participants\n`);
    return participants;
  }

  // ── Phase 1: draw ───────────────────────────────────────────────

  private loadOrCreateDraw(participants: Participant[]): DrawState {
    const hasSaved = this.stateStore.exists();

    if (this.options.resume) {
      if (!hasSaved) {
        throw new Error('Nothing to resume: no saved draw found. Start a new draw with: npm run santa');
      }
      const state = this.stateStore.load();
      if (state.participantsFingerprint !== participantsFingerprint(participants)) {
        throw new Error(
          'participants.json changed since the saved draw was made. ' +
          'Restore it, or start over with npm run santa:fresh (people who already got an email will get a new one).'
        );
      }
      const sent = state.entries.filter(e => e.sentAt).length;
      console.log(`↩️  Resuming saved draw from ${state.createdAt} (${sent}/${state.entries.length} emails sent)\n`);
      return state;
    }

    if (hasSaved && !this.options.fresh) {
      throw new Error(
        'An unfinished draw is saved in state/. ' +
        'Finish it: npm run santa:resume  ·  Discard it and draw again: npm run santa:fresh ' +
        '(people who already got an email will get a new one).'
      );
    }

    if (hasSaved) {
      console.log('🗑️  Discarding the unfinished draw (--fresh)\n');
      this.stateStore.clear();
    }

    const state = this.createDraw(participants);
    this.stateStore.save(state);
    return state;
  }

  private createDraw(participants: Participant[]): DrawState {
    console.log('🎲 Performing Secret Santa assignment...');
    const assignments = this.algorithm.assign(participants);

    // Store entries in config order, not in cycle order, so the processing
    // order in the logs says nothing about who drew whom
    const order = new Map(participants.map((p, i) => [p.name, i]));
    const entries: DrawEntry[] = assignments
      .map(({ gifter, giftee }) => ({ gifter, giftee }))
      .sort((a, b) => order.get(a.gifter.name)! - order.get(b.gifter.name)!);

    console.log(`✓ Created ${entries.length} assignments\n`);

    return {
      version: 1,
      createdAt: new Date().toISOString(),
      drawCode: crypto.randomBytes(2).toString('hex').toUpperCase(),
      participantsFingerprint: participantsFingerprint(participants),
      entries,
    };
  }

  // ── Verification ────────────────────────────────────────────────

  /**
   * Print a spoiler-free report: structure checks, the gift graph with
   * names replaced by per-run random hashes (no name → hash mapping is
   * ever shown), and the list of email recipients without their pairs.
   */
  private printVerificationReport(state: DrawState, participants: Participant[]): void {
    const report = verifyDraw(state.entries, participants);
    const mark = (ok: boolean) => (ok ? '✓' : '✗');
    const n = report.participantCount;

    console.log('🔍 Draw verification (no names revealed)');
    console.log(`   Draw code:                   #${state.drawCode}`);
    console.log(`   Participants:                ${n}`);
    console.log(`   Everyone gives exactly once: ${mark(report.everyoneGivesOnce)}`);
    console.log(`   Everyone gets exactly once:  ${mark(report.everyoneReceivesOnce)}`);
    console.log(`   Nobody drew themselves:      ${mark(report.noSelfAssignment)}`);
    console.log(`   Structure:                   ${describeCycles(report.cycleLengths)}`);

    // Fresh random key, separate from --encrypt-logs, so these hashes can't
    // be matched against masked names in the progress logs
    const masking = new LogEncryption();
    const graph = state.entries
      .map(e => `${masking.encryptName(e.gifter.name)} → ${masking.encryptName(e.giftee.name)}`)
      .sort();
    console.log('   Masked gift graph:');
    graph.forEach(line => console.log(`      ${line}`));

    const recipients = state.entries.map(e => this.formatNameForLog(e.gifter.name)).sort();
    console.log(`   Email recipients:            ${recipients.join(', ')}`);
    console.log('');

    if (!report.ok) {
      throw new Error('Draw verification failed - nothing was sent. Draw again with: npm run santa:fresh');
    }
  }

  private async confirmSending(state: DrawState): Promise<boolean> {
    if (this.options.yes) {
      return true;
    }
    const pending = state.entries.filter(e => !e.sentAt).length;
    return this.confirm(`Generate content and send ${pending} email(s)? [y/N] `);
  }

  // ── Phase 2: generate ───────────────────────────────────────────

  private async generateContent(state: DrawState): Promise<void> {
    const pending = state.entries.filter(e => !e.sentAt && this.needsContent(e));
    if (pending.length === 0) {
      return;
    }

    console.log(`🤖 Generating content for ${pending.length} participant(s)...\n`);

    for (let i = 0; i < pending.length; i++) {
      const entry = pending[i];
      console.log(`[${i + 1}/${pending.length}] ${this.formatNameForLog(entry.gifter.name)}`);

      if (!entry.message) {
        console.log('   📝 Generating message...');
        entry.message = await this.llmService.generateMessage(
          entry.gifter.name,
          entry.giftee.name,
          entry.giftee.description
        );
        this.persist(state);
      }

      if (!this.options.skipImages && !entry.image) {
        console.log('   🎨 Generating image...');
        const image = await this.imageService.generateImage(entry.giftee.description);
        entry.image = { base64: image.data.toString('base64'), mimeType: image.mimeType, extension: image.extension };
        this.persist(state);
      }

      console.log('   ✓ Done');
      if (i < pending.length - 1) {
        await sleep(this.options.generationDelayMs ?? DEFAULT_GENERATION_DELAY_MS);
      }
    }
    console.log('');
  }

  private needsContent(entry: DrawEntry): boolean {
    return !entry.message || (!this.options.skipImages && !entry.image);
  }

  // ── Phase 3: send / preview ─────────────────────────────────────

  private async sendAll(state: DrawState): Promise<void> {
    const pending = state.entries.filter(e => !e.sentAt);
    console.log(`📨 Sending ${pending.length} email(s)...\n`);

    for (let i = 0; i < pending.length; i++) {
      const entry = pending[i];
      console.log(`[${i + 1}/${pending.length}] ${this.formatEmailForLog(entry.gifter.email)}`);

      await withRetry(
        () => this.emailService!.sendSecretSantaEmail(
          entry.gifter,
          entry.giftee,
          entry.message!,
          toImage(entry),
          state.drawCode
        ),
        {
          shouldRetry: isTransientError,
          onRetry: (_error, attempt, delayMs) =>
            console.log(`   ⚠️  Attempt ${attempt} failed, retrying in ${delayMs / 1000}s...`),
        }
      );

      entry.sentAt = new Date().toISOString();
      this.persist(state);
      console.log('   ✓ Sent');
    }
    console.log('');
  }

  private writePreview(state: DrawState): void {
    fs.rmSync(this.outputDir, { recursive: true, force: true });
    fs.mkdirSync(this.outputDir, { recursive: true });

    for (const entry of state.entries) {
      const baseName = entry.gifter.name.replace(/[^\p{L}\p{N}]/gu, '_');
      const content = `Do: ${entry.gifter.name} <${entry.gifter.email}>
Temat: Twoje losowanie Secret Santa

Cześć ${entry.gifter.name},

Twoja wylosowana osoba: ${entry.giftee.name}

${entry.message}

---
Wygenerowano: ${new Date().toLocaleString()}
`;
      fs.writeFileSync(path.join(this.outputDir, `${baseName}_message.txt`), content, 'utf-8');

      const image = toImage(entry);
      if (image) {
        fs.writeFileSync(path.join(this.outputDir, `${baseName}_image.${image.extension}`), image.data);
      }
    }

    console.log(`💾 [DRY RUN] Preview written to ${this.outputDir}\n`);
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private persist(state: DrawState): void {
    if (!this.options.dryRun) {
      this.stateStore.save(state);
    }
  }

  private formatNameForLog(name: string): string {
    return this.logEncryption ? this.logEncryption.encryptName(name) : name;
  }

  private formatEmailForLog(email: string): string {
    return this.logEncryption ? this.logEncryption.encryptEmail(email) : email;
  }

  private printSuccess(): void {
    console.log('═'.repeat(50));
    console.log('✅ Secret Santa completed successfully!');
    if (this.options.dryRun) {
      console.log('   (Dry run - no emails were sent)');
    } else {
      console.log('   Saved draw deleted - the pairs are now known only to the participants.');
    }
    console.log('═'.repeat(50));
  }
}

function toImage(entry: DrawEntry): GeneratedImage | undefined {
  if (!entry.image) {
    return undefined;
  }
  return {
    data: Buffer.from(entry.image.base64, 'base64'),
    mimeType: entry.image.mimeType,
    extension: entry.image.extension,
  };
}

function describeCycles(lengths: number[]): string {
  if (lengths.length === 0) return 'invalid';
  if (lengths.length === 1) return `one cycle of ${lengths[0]}`;
  return `${lengths.length} cycles (${[...lengths].sort((a, b) => b - a).join(' + ')})`;
}

/**
 * Ask a yes/no question on the terminal. Refuses (returns false) when
 * there is no interactive terminal, so unattended runs need --yes.
 */
async function askYesNo(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.log('No interactive terminal - pass --yes to send without confirmation.');
    return false;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(question);
    return ['y', 'yes', 't', 'tak'].includes(answer.trim().toLowerCase());
  } finally {
    rl.close();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
