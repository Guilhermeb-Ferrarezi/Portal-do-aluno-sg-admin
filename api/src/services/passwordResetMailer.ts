type PasswordResetMailerOptions = {
  apiKey: string;
  fromEmail: string;
  replyToEmail?: string;
};

type PasswordResetEmailParams = {
  toEmail: string;
  toName?: string | null;
  resetUrl: string;
  expiresAt: string;
};

export type PasswordResetMailer = {
  sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<void>;
};

function buildHtml(params: PasswordResetEmailParams) {
  const firstName = params.toName?.trim() || "Olá";
  return `
    <div style="background:#0f172a;padding:32px;font-family:Arial,sans-serif;color:#e5e7eb">
      <div style="max-width:560px;margin:0 auto;background:#111827;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:32px">
        <h1 style="margin:0 0 12px;font-size:24px;color:#ffffff">Recuperação de senha</h1>
        <p style="margin:0 0 16px;line-height:1.6">${firstName}, recebemos um pedido para redefinir sua senha no portal administrativo.</p>
        <p style="margin:0 0 24px;line-height:1.6">Esse link expira em breve. Se você não fez essa solicitação, ignore este e-mail.</p>
        <a href="${params.resetUrl}" style="display:inline-block;padding:14px 22px;border-radius:14px;background:#e11d48;color:#ffffff;text-decoration:none;font-weight:700">
          Redefinir senha
        </a>
        <p style="margin:24px 0 8px;line-height:1.6;color:#cbd5e1">Se o botão não funcionar, copie e cole este link no navegador:</p>
        <p style="margin:0;word-break:break-all;color:#93c5fd">${params.resetUrl}</p>
        <p style="margin:24px 0 0;font-size:12px;color:#94a3b8">Expira em: ${new Date(params.expiresAt).toLocaleString("pt-BR")}</p>
      </div>
    </div>
  `;
}

function buildText(params: PasswordResetEmailParams) {
  return [
    "Recuperação de senha",
    "",
    "Recebemos um pedido para redefinir sua senha no portal administrativo.",
    `Use este link: ${params.resetUrl}`,
    `Expira em: ${new Date(params.expiresAt).toLocaleString("pt-BR")}`,
    "",
    "Se você não fez essa solicitação, ignore este e-mail.",
  ].join("\n");
}

export function createPasswordResetMailer(
  options: PasswordResetMailerOptions
): PasswordResetMailer {
  const apiKey = options.apiKey.trim();
  const fromEmail = options.fromEmail.trim();
  const replyToEmail = options.replyToEmail?.trim();

  return {
    async sendPasswordResetEmail(params) {
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
              subject: "Recuperação de senha",
            },
          ],
          content: [
            { type: "text/plain", value: buildText(params) },
            { type: "text/html", value: buildHtml(params) },
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
