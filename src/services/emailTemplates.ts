/**
 * HTML and plain-text templates for the Secret Santa email
 */

export interface EmailTemplateInput {
  gifterName: string;
  gifteeName: string;
  message: string;
  imageCid?: string;
  /** Short code of this draw, so participants can spot an email from an old run */
  drawCode?: string;
}

export const EMAIL_SUBJECT = '🎁 Wyniki losowania prezentów';

/**
 * Escape text so it can be safely embedded in HTML
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderHtmlEmail(input: EmailTemplateInput): string {
  const gifterName = escapeHtml(input.gifterName);
  const gifteeName = escapeHtml(input.gifteeName);
  const messageHtml = input.message
    .split('\n')
    .map(line => `<p>${line.trim() ? escapeHtml(line) : '&nbsp;'}</p>`)
    .join('');

  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Święty Mikołaj - Wyniki losowania prezentów</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      padding: 40px 30px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #d32f2f;
    }
    .header h1 {
      color: #d32f2f;
      margin: 10px 0;
      font-size: 24px;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 20px;
      color: #333333;
    }
    .giftee {
      text-align: center;
      margin: 25px 0;
      padding: 20px;
      border: 2px dashed #d32f2f;
    }
    .giftee .label {
      margin: 0;
      font-size: 14px;
      color: #666666;
    }
    .giftee .name {
      margin: 8px 0 0;
      font-size: 26px;
      font-weight: bold;
      color: #d32f2f;
    }
    .message-box {
      background-color: #fafafa;
      border-left: 4px solid #d32f2f;
      padding: 20px;
      margin: 25px 0;
    }
    .message-box p {
      margin: 10px 0;
      color: #333333;
    }
    .image-container {
      text-align: center;
      margin: 30px 0;
    }
    .image-container img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 0 auto;
    }
    .reminder {
      background-color: #fff3cd;
      border: 1px solid #ffc107;
      padding: 15px;
      margin: 25px 0;
      color: #856404;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #dddddd;
      font-size: 13px;
      color: #666666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎅 Święty Mikołaj - Wyniki losowania prezentów 🎁</h1>
    </div>

    <div class="greeting">
      <p>Cześć ${gifterName}!</p>
    </div>

    <div class="giftee">
      <p class="label">Twoja wylosowana osoba:</p>
      <p class="name">🎁 ${gifteeName}</p>
    </div>

    <div class="message-box">
      ${messageHtml}
    </div>
${input.imageCid ? `
    <div class="image-container">
      <img src="cid:${input.imageCid}" alt="Ilustracja świąteczna" />
    </div>
` : ''}
    <div class="reminder">
      <p><strong>Ważne przypomnienie:</strong></p>
      <p>Wylosowana osoba to tajemnica! Nie zdradzaj nikomu, komu robisz prezent.</p>
      <p>Miłego przygotowywania prezentu i wesołych świąt!</p>
    </div>

    <div class="footer">
      <p>Ta wiadomość została wygenerowana automatycznie w ramach zabawy Secret Santa.</p>
      <p>Jeśli masz pytania, skontaktuj się z organizatorem.</p>
      <p>🎄 Wesołych Świąt! 🎄</p>${input.drawCode ? `
      <p style="font-size: 11px; color: #999;">Kod losowania: #${escapeHtml(input.drawCode)}</p>` : ''}
      <p style="font-size: 11px; color: #999; margin-top: 20px;">
        Otrzymujesz tę wiadomość, ponieważ bierzesz udział w zabawie Secret Santa.<br>
        Jeśli nie chcesz otrzymywać więcej wiadomości, skontaktuj się z organizatorem.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function renderTextEmail(input: EmailTemplateInput): string {
  return `
ŚWIĘTY MIKOŁAJ

Cześć ${input.gifterName}!

Twoja wylosowana osoba: ${input.gifteeName}

${input.message}

WAŻNE PRZYPOMNIENIE:
Wylosowana osoba to tajemnica! Nie zdradzaj nikomu, komu robisz prezent.
Miłego przygotowywania prezentu i wesołych świąt!

---
Ta wiadomość została wygenerowana automatycznie w ramach zabawy Secret Santa.
Jeśli masz pytania, skontaktuj się z organizatorem.

🎄 Wesołych Świąt! 🎄${input.drawCode ? `\nKod losowania: #${input.drawCode}` : ''}
  `.trim();
}
