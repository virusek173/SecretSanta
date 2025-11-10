import { SecretSantaAlgorithm } from '../../algorithm/secretSanta';
import { Participant } from '../../types';

describe('SecretSantaAlgorithm', () => {
  let algorithm: SecretSantaAlgorithm;

  beforeEach(() => {
    algorithm = new SecretSantaAlgorithm();
  });

  const createParticipants = (count: number): Participant[] => {
    return Array.from({ length: count }, (_, i) => ({
      name: `Person${i + 1}`,
      email: `person${i + 1}@example.com`,
      description: `Loves hobby${i + 1}`,
    }));
  };

  describe('Input validation', () => {
    it('should throw error when less than 3 participants', () => {
      const participants = createParticipants(2);
      expect(() => algorithm.assign(participants)).toThrow(
        'At least 3 participants are required for Secret Santa'
      );
    });

    it('should throw error when participants array is empty', () => {
      expect(() => algorithm.assign([])).toThrow(
        'At least 3 participants are required for Secret Santa'
      );
    });

    it('should throw error when duplicate names exist', () => {
      const participants: Participant[] = [
        { name: 'Alice', email: 'alice1@example.com', description: 'Likes books' },
        { name: 'Bob', email: 'bob@example.com', description: 'Likes sports' },
        { name: 'Alice', email: 'alice2@example.com', description: 'Likes music' },
      ];
      expect(() => algorithm.assign(participants)).toThrow(
        'Duplicate participant names are not allowed'
      );
    });
  });

  describe('Assignment correctness', () => {
    it('should create correct number of assignments', () => {
      const participants = createParticipants(5);
      const assignments = algorithm.assign(participants);

      expect(assignments).toHaveLength(5);
    });

    it('should ensure no one gives to themselves', () => {
      const participants = createParticipants(5);
      const assignments = algorithm.assign(participants);

      for (const assignment of assignments) {
        expect(assignment.gifter.name).not.toBe(assignment.giftee.name);
      }
    });

    it('should ensure each person gives exactly once', () => {
      const participants = createParticipants(5);
      const assignments = algorithm.assign(participants);

      const gifters = assignments.map(a => a.gifter.name);
      const uniqueGifters = new Set(gifters);

      expect(uniqueGifters.size).toBe(participants.length);
    });

    it('should ensure each person receives exactly once', () => {
      const participants = createParticipants(5);
      const assignments = algorithm.assign(participants);

      const giftees = assignments.map(a => a.giftee.name);
      const uniqueGiftees = new Set(giftees);

      expect(uniqueGiftees.size).toBe(participants.length);
    });

    it('should work for minimum size of 3 participants', () => {
      const participants = createParticipants(3);
      const assignments = algorithm.assign(participants);

      expect(assignments).toHaveLength(3);

      // No self-assignments
      for (const assignment of assignments) {
        expect(assignment.gifter.name).not.toBe(assignment.giftee.name);
      }
    });
  });

  describe('Randomization', () => {
    it('should produce different results on multiple runs', () => {
      const participants = createParticipants(10);

      const results = new Set<string>();
      const runs = 20;

      for (let i = 0; i < runs; i++) {
        const assignments = algorithm.assign(participants);
        // Create a signature of this assignment
        const signature = assignments.map(a => `${a.gifter.name}->${a.giftee.name}`).join('|');
        results.add(signature);
      }

      // With 10 people, we should get different arrangements most of the time
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('Edge cases', () => {
    it('should handle participants with special characters in names', () => {
      const participants: Participant[] = [
        { name: 'Anne-Marie O\'Connor', email: 'anne@example.com', description: 'Books' },
        { name: 'José García', email: 'jose@example.com', description: 'Music' },
        { name: 'Jan Müller', email: 'jan@example.com', description: 'Sports' },
      ];

      const assignments = algorithm.assign(participants);
      expect(assignments).toHaveLength(3);
    });

    it('should handle large groups', () => {
      const participants = createParticipants(50);
      const assignments = algorithm.assign(participants);

      expect(assignments).toHaveLength(50);

      // No self-assignments
      for (const assignment of assignments) {
        expect(assignment.gifter.name).not.toBe(assignment.giftee.name);
      }
    });
  });
});
