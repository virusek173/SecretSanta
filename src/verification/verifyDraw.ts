import { DrawEntry, Participant } from '../types';

export interface DrawReport {
  participantCount: number;
  /** Everyone gives exactly one gift */
  everyoneGivesOnce: boolean;
  /** Everyone receives exactly one gift */
  everyoneReceivesOnce: boolean;
  /** Nobody drew themselves */
  noSelfAssignment: boolean;
  /** Lengths of the gift cycles; a valid draw from our algorithm is a single cycle */
  cycleLengths: number[];
  ok: boolean;
}

/**
 * Check the structure of a draw without exposing who drew whom.
 */
export function verifyDraw(entries: DrawEntry[], participants: Participant[]): DrawReport {
  const names = participants.map(p => p.name);
  const count = (list: string[]) => names.map(name => list.filter(n => n === name).length);

  const everyoneGivesOnce = entries.length === names.length
    && count(entries.map(e => e.gifter.name)).every(c => c === 1);
  const everyoneReceivesOnce = entries.length === names.length
    && count(entries.map(e => e.giftee.name)).every(c => c === 1);
  const noSelfAssignment = entries.every(e => e.gifter.name !== e.giftee.name);

  const cycleLengths = everyoneGivesOnce && everyoneReceivesOnce ? findCycles(entries) : [];

  return {
    participantCount: names.length,
    everyoneGivesOnce,
    everyoneReceivesOnce,
    noSelfAssignment,
    cycleLengths,
    ok: everyoneGivesOnce && everyoneReceivesOnce && noSelfAssignment && cycleLengths.length > 0,
  };
}

function findCycles(entries: DrawEntry[]): number[] {
  const next = new Map(entries.map(e => [e.gifter.name, e.giftee.name]));
  const visited = new Set<string>();
  const lengths: number[] = [];

  for (const start of next.keys()) {
    if (visited.has(start)) continue;
    let length = 0;
    let current: string | undefined = start;
    while (current !== undefined && !visited.has(current)) {
      visited.add(current);
      current = next.get(current);
      length++;
    }
    lengths.push(length);
  }
  return lengths;
}
