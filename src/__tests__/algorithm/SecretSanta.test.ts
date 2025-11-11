import { SecretSantaAlgorithm } from '../../algorithm/SecretSanta';
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
      // Using 10 participants to have sufficient possible arrangements
      // For 10 people, there are !10 (subfactorial) ≈ 1.3 million possible derangements
      const participants = createParticipants(10);

      const results = new Set<string>();
      // Running 20 times - with proper randomization, collision probability is extremely low
      const runs = 20;

      for (let i = 0; i < runs; i++) {
        const assignments = algorithm.assign(participants);
        // Create a canonical signature by sorting the pairs alphabetically
        // This ensures the same assignment structure always produces the same signature
        // regardless of the order in which assignments are returned
        const pairs = assignments
          .map(a => `${a.gifter.name}->${a.giftee.name}`)
          .sort();
        const signature = pairs.join('|');
        results.add(signature);
      }

      // Expecting at least 19 unique results out of 20 runs
      // With ~1.3M possible arrangements, getting duplicates is statistically negligible
      // If we get fewer unique results, it indicates the algorithm is not properly randomized
      expect(results.size).toBeGreaterThanOrEqual(19);
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
