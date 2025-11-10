import * as dotenv from 'dotenv';
import { SecretSantaApp } from './SecretSantaApp';

dotenv.config();

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const skipImages = process.argv.includes('--no-images');

  try {
    const app = new SecretSantaApp(dryRun, skipImages);
    await app.run();
  } catch (error) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
