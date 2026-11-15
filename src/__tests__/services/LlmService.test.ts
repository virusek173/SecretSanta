import { createPrompt } from '../../services/LlmService';
import { ParticipantValidator } from '../../utils/validators';
import { Participant } from '../../types';

const mirka: Participant = { name: 'Mirka', email: 'm@example.com', description: 'Lubi ogród', gender: 'female' };
const kuba: Participant = { name: 'Kuba', email: 'k@example.com', description: 'Gra w szachy', gender: 'male' };

describe('createPrompt', () => {
  it('states both genders when given', () => {
    const prompt = createPrompt(mirka, kuba);
    expect(prompt).toContain('Mirka to kobieta.');
    expect(prompt).toContain('Kuba to mężczyzna.');
  });

  it('says the gender is unknown instead of letting the model guess', () => {
    const prompt = createPrompt({ ...mirka, gender: undefined }, kuba);
    expect(prompt).toContain('Płeć osoby Mirka nie jest podana.');
  });

  it('uses the giftee description for the gift idea, not the gifter one', () => {
    const prompt = createPrompt(mirka, kuba);
    expect(prompt).toContain('Gra w szachy');
    expect(prompt).not.toContain('Lubi ogród');
  });
});

describe('ParticipantValidator gender', () => {
  const validator = new ParticipantValidator();

  it('accepts female, male or no gender', () => {
    expect(() => validator.validateParticipant(mirka)).not.toThrow();
    expect(() => validator.validateParticipant(kuba)).not.toThrow();
    expect(() => validator.validateParticipant({ ...kuba, gender: undefined })).not.toThrow();
  });

  it('rejects other values', () => {
    const bad = { ...kuba, gender: 'M' } as unknown as Participant;
    expect(() => validator.validateParticipant(bad)).toThrow('use "female" or "male"');
  });
});
