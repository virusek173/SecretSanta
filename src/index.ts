import * as dotenv from 'dotenv';
import { SecretSantaApp } from './SecretSantaApp';

dotenv.config({ quiet: true });

async function main() {
  const args = process.argv.slice(2);
  const knownFlags = ['--dry-run', '--no-images', '--encrypt-logs', '--resume', '--fresh', '--yes'];
  const unknown = args.filter(arg => !knownFlags.includes(arg));
  if (unknown.length > 0) {
    console.error(`Unknown option(s): ${unknown.join(', ')}\nAvailable: ${knownFlags.join(', ')}`);
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
    });
    await app.run();
  } catch (error) {
    console.error('Fatal error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
