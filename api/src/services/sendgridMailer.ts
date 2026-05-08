type SendgridMailerOptions = {
  apiKey: string;
  fromEmail: string;
  replyToEmail?: string;
};

type SendEmailParams = {
  toEmail: string;
  toName?: string | null;
  subject: string;
  text: string;
  html?: string;
};

export type SendgridMailer = {
  sendEmail(params: SendEmailParams): Promise<void>;
};

function escapeHtml(value: string) {
  return value
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;")
    .split("'").join("&#39;");
}

function buildDefaultHtml(params: SendEmailParams) {
  const greeting = params.toName?.trim() ? `Olá, ${escapeHtml(params.toName.trim())}` : "Olá";
  const paragraphs = params.text
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p style="margin:0 0 16px;line-height:1.7">${escapeHtml(block).split("\n").join("<br />")}</p>`)
    .join("");

  return `
    <div style="background:#0f172a;padding:32px;font-family:Arial,sans-serif;color:#e5e7eb">
      <div style="max-width:640px;margin:0 auto;background:#111827;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:32px">
        <p style="margin:0 0 18px;line-height:1.6">${greeting}</p>
        <h1 style="margin:0 0 18px;font-size:24px;color:#ffffff">${escapeHtml(params.subject)}</h1>
        ${paragraphs}
      </div>
    </div>
  `;
}

export function createSendgridMailer(options: SendgridMailerOptions): SendgridMailer {
  const apiKey = options.apiKey.trim();
  const fromEmail = options.fromEmail.trim();
  const replyToEmail = options.replyToEmail?.trim();

  return {
    async sendEmail(params) {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: { email: fromEmail },
          reply_to: replyToEmail ? { email: replyToEmail } : undefined,
          personalizations: [
            {
              to: [
                {
                  email: params.toEmail,
                  ...(params.toName?.trim() ? { name: params.toName.trim() } : {}),
                },
              ],
              subject: params.subject,
            },
          ],
          content: [
            { type: "text/plain", value: params.text },
            { type: "text/html", value: params.html?.trim() || buildDefaultHtml(params) },
          ],
        }),
      });

      if (!response.ok) {
        const raw = await response.text().catch(() => "");
        throw new Error(`SendGrid ${response.status}: ${raw || response.statusText}`);
      }
    },
  };
}
