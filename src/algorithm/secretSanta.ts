import { Participant, Assignment, ISecretSantaAlgorithm } from '../types';

/**
 * Secret Santa assignment algorithm
 *
 * Creates a cyclic graph where each participant gives to exactly one person
 * and receives from exactly one person.
 *
 * Algorithm:
 * 1. Validate input
 * 2. Shuffle participants to randomize
 * 3. Create a cycle by assigning each person to the next (i -> i+1)
 */
export class SecretSantaAlgorithm implements ISecretSantaAlgorithm {
  /**
   * Assign participants to each other for Secret Santa
   * @param participants List of participants
   * @returns Array of assignments
   * @throws Error if invalid input
   */
  assign(participants: Participant[]): Assignment[] {
    this.validateInput(participants);

    // Shuffle participants for randomization
    const shuffled = this.shuffle([...participants]);

    // Create cyclic assignments: person i gives to person i+1, last gives to first
    const assignments: Assignment[] = [];
    for (let i = 0; i < shuffled.length; i++) {
      const gifter = shuffled[i];
      const giftee = shuffled[(i + 1) % shuffled.length];
      assignments.push({ gifter, giftee });
    }

    return assignments;
  }

  /**
   * Validate input parameters
   */
  private validateInput(participants: Participant[]): void {
    if (!participants || participants.length < 3) {
      throw new Error('At least 3 participants are required for Secret Santa');
    }

    // Check for duplicate names
    const names = participants.map(p => p.name);
    const uniqueNames = new Set(names);
    if (names.length !== uniqueNames.size) {
      throw new Error('Duplicate participant names are not allowed');
    }
  }

  /**
   * Fisher-Yates shuffle algorithm
   */
  private shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}
