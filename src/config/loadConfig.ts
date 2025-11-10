import * as fs from 'fs';
import * as path from 'path';
import { Config, IConfigLoader, Participant } from '../types';
import { ParticipantValidator } from '../utils/validators';

/**
 * Configuration loader for participants
 */
export class ConfigLoader implements IConfigLoader {
  private validator: ParticipantValidator;
  private configPath: string;

  constructor(configPath?: string) {
    this.validator = new ParticipantValidator();
    this.configPath = configPath || path.join(process.cwd(), 'config', 'participants.json');
  }

  /**
   * Load configuration from JSON file
   */
  loadConfig(): Config {
    try {
      // Check if file exists
      if (!fs.existsSync(this.configPath)) {
        throw new Error(`Configuration file not found: ${this.configPath}`);
      }

      // Read and parse JSON
      const fileContent = fs.readFileSync(this.configPath, 'utf-8');
      const data = JSON.parse(fileContent);

      // Validate structure
      if (!data.participants || !Array.isArray(data.participants)) {
        throw new Error('Configuration must contain a "participants" array');
      }

      const participants: Participant[] = data.participants;

      // Validate all participants
      this.validator.validateParticipants(participants);

      return {
        participants,
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in configuration file: ${error.message}`);
      }
      if (error instanceof Error) {
        throw new Error(`Failed to load configuration: ${error.message}`);
      }
      throw new Error('Failed to load configuration: Unknown error');
    }
  }

  /**
   * Get the current config path
   */
  getConfigPath(): string {
    return this.configPath;
  }
}
