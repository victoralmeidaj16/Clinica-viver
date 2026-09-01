interface AcaoEmail {
  label: string;
  href: string;
}

interface ViverMaisEmailTemplate {
  preheader: string;
  eyebrow: string;
  titulo: string;
  saudacao: string;
  paragrafos: string[];
  acaoPrincipal?: AcaoEmail;
  acaoSecundaria?: AcaoEmail;
  aviso?: string;
}

const LOGO_URL = 'https://clinicavivermais.cloud/logo-viver-mais.png';

function botao({ label, href }: AcaoEmail, secundario = false): string {
  const background = secundario ? '#ffffff' : '#43265e';
  const color = secundario ? '#43265e' : '#ffffff';
  const border = secundario ? '1px solid #d8c7e7' : '1px solid #43265e';
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:${secundario ? '12px' : '26px'} auto 0;width:100%;">
    <tr><td align="center">
      <a href="${href}" style="background:${background};border:${border};border-radius:10px;color:${color};display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;line-height:20px;padding:14px 26px;text-align:center;text-decoration:none;min-width:210px;">${label}</a>
    </td></tr>
  </table>`;
}

/** HTML transacional compatível com clientes de e-mail, usando somente estilos inline. */
export function montarEmailViverMais(template: ViverMaisEmailTemplate): string {
  const corpo = template.paragrafos
    .map((paragrafo) => `<p style="color:#544b52;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;margin:0 0 16px;">${paragrafo}</p>`)
    .join('');
  const aviso = template.aviso ? `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="background:#f6f0fa;border-left:4px solid #9e6bcf;border-radius:8px;margin-top:28px;width:100%;">
    <tr><td style="padding:15px 18px;">
      <p style="color:#43265e;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;margin:0;"><strong style="color:#43265e;">Sua segurança importa.</strong><br>${template.aviso}</p>
    </td></tr>
  </table>` : '';

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${template.titulo}</title></head>
<body style="background:#f4efe9;margin:0;padding:0;word-spacing:normal;">
  <div style="display:none;font-size:1px;color:#f4efe9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${template.preheader}</div>
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="background:#f4efe9;width:100%;">
    <tr><td align="center" style="padding:34px 14px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">
        <tr><td style="padding:0 8px 18px;">
          <a href="https://clinicavivermais.cloud" style="text-decoration:none;"><img src="${LOGO_URL}" width="264" alt="Viver Mais Psicologia" style="border:0;display:block;height:auto;max-width:100%;width:264px;"></a>
        </td></tr>
        <tr><td style="background:#43265e;border-radius:18px 18px 0 0;padding:34px 42px 32px;">
          <p style="color:#d9baf2;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.8px;line-height:16px;margin:0 0 12px;text-transform:uppercase;">${template.eyebrow}</p>
          <h1 style="color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:32px;font-weight:400;letter-spacing:-0.5px;line-height:39px;margin:0;">${template.titulo}</h1>
        </td></tr>
        <tr><td style="background:#ffffff;border-radius:0 0 18px 18px;padding:38px 42px 40px;">
          <p style="color:#2a2028;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:28px;margin:0 0 20px;">${template.saudacao}</p>
          ${corpo}
          ${template.acaoPrincipal ? botao(template.acaoPrincipal) : ''}
          ${template.acaoSecundaria ? botao(template.acaoSecundaria, true) : ''}
          ${aviso}
          <div style="border-top:1px solid #eadff0;margin-top:32px;padding-top:24px;">
            <p style="color:#2a2028;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:21px;margin:0 0 3px;">Equipe Viver Mais Psicologia</p>
            <p style="color:#847982;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;margin:0;">Cuidado, escuta e continuidade em cada etapa.</p>
          </div>
        </td></tr>
        <tr><td align="center" style="padding:22px 20px 4px;">
          <p style="color:#847982;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;margin:0;">Mensagem automática enviada pela Clínica Viver Mais Psicologia.<br><a href="https://clinicavivermais.cloud" style="color:#5c397d;text-decoration:underline;">clinicavivermais.cloud</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
