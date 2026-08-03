/**
 * Optional outbound mail for password reset.
 * Priority: RESEND_API_KEY → MAIL_WEBHOOK_URL → console log.
 */
export async function sendPasswordResetMail({ to, resetUrl }) {
  const subject = 'Qupıya sózdı tiklew';
  const text = `Qupıya sózdı tiklew ushın bul siltemeni ashıń (1 saat):\n\n${resetUrl}\n\nEger siz soramaǵan bolsańız — bul xatdı ótkizip jiberiń.`;
  const html = `<p>Qupıya sózdı tiklew ushın <a href="${resetUrl}">bul siltemeni</a> ashıń (1 saat).</p><p>Eger siz soramaǵan bolsańız — bul xatdı ótkizip jiberiń.</p>`;

  const resendKey = process.env.RESEND_API_KEY || '';
  const from = process.env.MAIL_FROM || 'noreply@localhost';

  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [to], subject, text, html }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.warn('[mail] Resend failed:', res.status, body.slice(0, 200));
        return { delivered: false, channel: 'resend' };
      }
      return { delivered: true, channel: 'resend' };
    } catch (err) {
      console.warn('[mail] Resend error:', err.message);
      return { delivered: false, channel: 'resend' };
    }
  }

  const webhook = process.env.MAIL_WEBHOOK_URL || '';
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, text, html, resetUrl, type: 'password_reset' }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        console.warn('[mail] Webhook failed:', res.status);
        return { delivered: false, channel: 'webhook' };
      }
      return { delivered: true, channel: 'webhook' };
    } catch (err) {
      console.warn('[mail] Webhook error:', err.message);
      return { delivered: false, channel: 'webhook' };
    }
  }

  if (process.env.NODE_ENV === 'production') {
    console.info(`[mail] password-reset queued for ${to} (no outbound mail configured)`);
  } else {
    console.info(`[mail] password-reset → ${to}\n${resetUrl}`);
  }
  return { delivered: false, channel: 'log' };
}
