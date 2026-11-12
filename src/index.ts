import * as dotenv from 'dotenv';
import { SecretSantaApp } from './SecretSantaApp';

dotenv.config({ quiet: true });

const OPTIONS: Record<string, string> = {
  '--dry-run': 'Generate content into output/ instead of sending (output/ reveals every pair)',
  '--no-images': 'Skip image generation',
  '--encrypt-logs': 'Mask names and emails in progress logs',
  '--resume': 'Continue the unfinished draw saved in state/',
  '--fresh': 'Discard the unfinished draw and draw again',
  '--yes': 'Send without the [y/N] confirmation (required without a terminal)',
  '--participants <file>': 'Participants file (default: config/participants.json)',
  '--help': 'Show this help',
};

const HELP = `Usage: node dist/index.js [options]

Runs the draw, generates messages and images, then emails every participant.

Options:
${Object.entries(OPTIONS).map(([flag, text]) => `  ${flag.padEnd(24)}${text}`).join('\n')}

Exit code: 0 on success or when sending was declined, 1 on any error.`;

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    return;
  }

  let participantsPath: string | undefined;
  const pathIndex = args.indexOf('--participants');
  if (pathIndex !== -1) {
    participantsPath = args[pathIndex + 1];
    if (!participantsPath || participantsPath.startsWith('--')) {
      console.error('--participants requires a file path');
      process.exit(1);
    }
    args.splice(pathIndex, 2);
  }

  const flags = Object.keys(OPTIONS).map(option => option.split(' ')[0]);
  const unknown = args.filter(arg => !flags.includes(arg));
  if (unknown.length > 0) {
    console.error(`Unknown option(s): ${unknown.join(', ')}\n\n${HELP}`);
    process.exit(1);
  }

  try {
    const app = new SecretSantaApp({
      dryRun: args.includes('--dry-run'),
      skipImages: args.includes('--no-images'),
      encryptLogs: args.includes('--encrypt-logs'),
      resume: args.includes('--resume'),
      fresh: args.includes('--fresh'),
      yes: args.includes('--yes'),
      participantsPath,
    });
    await app.run();
  } catch (error) {
    console.error('Fatal error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
