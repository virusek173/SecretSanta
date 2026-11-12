import { LogEncryption } from '../../utils/encryption';

describe('LogEncryption', () => {
  describe('encryptName', () => {
    it('should consistently encrypt the same name', () => {
      const encryption = new LogEncryption();
      const name = 'Jan Kowalski';

      const encrypted1 = encryption.encryptName(name);
      const encrypted2 = encryption.encryptName(name);

      expect(encrypted1).toBe(encrypted2);
      expect(encrypted1).toMatch(/^\[USER-[A-F0-9]{8}\]$/);
    });

    it('should produce different encrypted values for different names', () => {
      const encryption = new LogEncryption();
      const name1 = 'Jan Kowalski';
      const name2 = 'Anna Nowak';

      const encrypted1 = encryption.encryptName(name1);
      const encrypted2 = encryption.encryptName(name2);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle empty string', () => {
      const encryption = new LogEncryption();
      const result = encryption.encryptName('');

      expect(result).toBe('[EMPTY]');
    });
  });

  describe('encryptEmail', () => {
    it('should mask email addresses', () => {
      const encryption = new LogEncryption();
      const email = 'jan.kowalski@example.com';

      const encrypted = encryption.encryptEmail(email);

      expect(encrypted).toMatch(/^\*\*\*@[a-f0-9]{8}\.masked$/);
      expect(encrypted).not.toContain('jan');
      expect(encrypted).not.toContain('kowalski');
      expect(encrypted).not.toContain('example');
    });

    it('should consistently encrypt the same email', () => {
      const encryption = new LogEncryption();
      const email = 'jan.kowalski@example.com';

      const encrypted1 = encryption.encryptEmail(email);
      const encrypted2 = encryption.encryptEmail(email);

      expect(encrypted1).toBe(encrypted2);
    });

    it('should handle empty string', () => {
      const encryption = new LogEncryption();
      const result = encryption.encryptEmail('');

      expect(result).toBe('[EMPTY]');
    });
  });

  describe('custom key', () => {
    it('should use custom key for encryption', () => {
      const customKey = 'my-secret-key-12345';
      const encryption1 = new LogEncryption(customKey);
      const encryption2 = new LogEncryption(customKey);

      const name = 'Jan Kowalski';
      const encrypted1 = encryption1.encryptName(name);
      const encrypted2 = encryption2.encryptName(name);

      expect(encrypted1).toBe(encrypted2);
    });

    it('should produce different results with different keys', () => {
      const encryption1 = new LogEncryption('key1');
      const encryption2 = new LogEncryption('key2');

      const name = 'Jan Kowalski';
      const encrypted1 = encryption1.encryptName(name);
      const encrypted2 = encryption2.encryptName(name);

      expect(encrypted1).not.toBe(encrypted2);
    });
  });
});
