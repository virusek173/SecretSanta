import * as dotenv from 'dotenv';
import { SecretSantaApp } from './SecretSantaApp';

dotenv.config();

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const shouldSkipImages = process.argv.includes('--no-images');

  try {
    const app = new SecretSantaApp(isDryRun, shouldSkipImages);
    await app.run();
  } catch (error) {
    console.error('Fatal error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
