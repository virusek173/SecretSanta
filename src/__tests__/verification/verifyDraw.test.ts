import { verifyDraw } from '../../verification/verifyDraw';
import { SecretSantaAlgorithm } from '../../algorithm/SecretSanta';
import { DrawEntry, Participant } from '../../types';

const people: Participant[] = ['A', 'B', 'C', 'D'].map(name => ({
  name,
  email: `${name.toLowerCase()}@example.com`,
  description: 'x',
}));
const byName = (name: string) => people.find(p => p.name === name)!;
const draw = (...pairs: [string, string][]): DrawEntry[] =>
  pairs.map(([gifter, giftee]) => ({ gifter: byName(gifter), giftee: byName(giftee) }));

describe('verifyDraw', () => {
  it('accepts a draw from the algorithm as a single full cycle', () => {
    const entries = new SecretSantaAlgorithm().assign(people);
    const report = verifyDraw(entries, people);
    expect(report.ok).toBe(true);
    expect(report.cycleLengths).toEqual([4]);
  });

  it('reports multiple cycles', () => {
    const report = verifyDraw(draw(['A', 'B'], ['B', 'A'], ['C', 'D'], ['D', 'C']), people);
    expect(report.ok).toBe(true);
    expect(report.cycleLengths.sort()).toEqual([2, 2]);
  });

  it('detects self-assignment', () => {
    const report = verifyDraw(draw(['A', 'A'], ['B', 'C'], ['C', 'D'], ['D', 'B']), people);
    expect(report.noSelfAssignment).toBe(false);
    expect(report.ok).toBe(false);
  });

  it('detects someone receiving twice', () => {
    const report = verifyDraw(draw(['A', 'B'], ['B', 'C'], ['C', 'B'], ['D', 'A']), people);
    expect(report.everyoneReceivesOnce).toBe(false);
    expect(report.ok).toBe(false);
  });

  it('detects a missing gifter', () => {
    const report = verifyDraw(draw(['A', 'B'], ['B', 'C'], ['C', 'A']), people);
    expect(report.everyoneGivesOnce).toBe(false);
    expect(report.ok).toBe(false);
  });
});
