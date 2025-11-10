import validator from 'validator';
import { Participant } from '../types';

/**
 * Validator for participant data
 */
export class ParticipantValidator {
  /**
   * Validate email address format
   */
  validateEmail(email: string): boolean {
    return validator.isEmail(email);
  }

  /**
   * Validate single participant data
   */
  validateParticipant(participant: Participant): void {
    if (!participant.name || participant.name.trim().length === 0) {
      throw new Error('Participant name cannot be empty');
    }

    if (!participant.email || participant.email.trim().length === 0) {
      throw new Error('Participant email cannot be empty');
    }

    if (!this.validateEmail(participant.email)) {
      throw new Error(`Invalid email address: ${participant.email}`);
    }

    if (!participant.description || participant.description.trim().length === 0) {
      throw new Error('Participant description cannot be empty');
    }
  }

  /**
   * Validate all participants
   */
  validateParticipants(participants: Participant[]): void {
    if (!participants || participants.length === 0) {
      throw new Error('Participants list cannot be empty');
    }

    for (const participant of participants) {
      this.validateParticipant(participant);
    }
  }
}
