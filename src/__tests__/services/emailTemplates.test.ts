import { escapeHtml, renderHtmlEmail, renderTextEmail } from '../../services/emailTemplates';

describe('emailTemplates', () => {
  const input = {
    gifterName: 'Anna',
    gifteeName: 'Jan Nowak',
    message: 'Linia 1\n\nLinia 2',
  };

  describe('escapeHtml', () => {
    it('escapes HTML special characters', () => {
      expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe(
        '&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;'
      );
    });
  });

  describe('renderHtmlEmail', () => {
    it('shows the giftee name explicitly', () => {
      const html = renderHtmlEmail(input);
      expect(html).toContain('Twoja wylosowana osoba:');
      expect(html).toContain('Jan Nowak');
    });

    it('escapes AI-generated message content', () => {
      const html = renderHtmlEmail({ ...input, message: 'Prezent <script>alert(1)</script> & kawa' });
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&amp; kawa');
    });

    it('escapes participant names', () => {
      const html = renderHtmlEmail({ ...input, gifteeName: '<i>Jan</i>' });
      expect(html).toContain('&lt;i&gt;Jan&lt;/i&gt;');
    });

    it('renders empty message lines as spacers', () => {
      expect(renderHtmlEmail(input)).toContain('<p>Linia 1</p><p>&nbsp;</p><p>Linia 2</p>');
    });

    it('includes the inline image only when a cid is given', () => {
      expect(renderHtmlEmail(input)).not.toContain('cid:');
      expect(renderHtmlEmail({ ...input, imageCid: 'img-1' })).toContain('src="cid:img-1"');
    });
  });

  describe('renderTextEmail', () => {
    it('shows the giftee name explicitly', () => {
      expect(renderTextEmail(input)).toContain('Twoja wylosowana osoba: Jan Nowak');
    });
  });
});
