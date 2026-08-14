import 'server-only';

/**
 * Defesas mínimas das rotas que atendem quem não tem sessão.
 *
 * O link de pagamento e o link de agenda têm a mesma exposição: um endereço
 * que circula no WhatsApp e aceita CPF. Sem freio, os dois viram oráculo de
 * "este CPF é paciente deste psicólogo" para quem tiver paciência de iterar.
 *
 * O balde é por rota, não global: estourar as tentativas de identificação na
 * agenda não pode impedir o mesmo paciente de pagar a sessão.
 */

const baldes = new Map<string, Map<string, { count: number; resetAt: number }>>();

function origem(request: Request): string {
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export function rateLimited(
  request: Request,
  balde: string,
  { limite = 8, janelaMs = 10 * 60_000 } = {}
): boolean {
  let tentativas = baldes.get(balde);
  if (!tentativas) {
    tentativas = new Map();
    baldes.set(balde, tentativas);
  }

  const chave = origem(request);
  const agora = Date.now();
  if (tentativas.size > 5_000) {
    for (const [candidato, valor] of tentativas) {
      if (valor.resetAt <= agora) tentativas.delete(candidato);
    }
  }

  const atual = tentativas.get(chave);
  if (!atual || atual.resetAt <= agora) {
    tentativas.set(chave, { count: 1, resetAt: agora + janelaMs });
    return false;
  }
  atual.count += 1;
  return atual.count > limite;
}

/** Dígitos verificadores do CPF. Rejeita antes de qualquer consulta ao banco. */
export function validCpf(value: string): boolean {
  const cpf = value.replace(/\D/g, '');
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (part: string, weight: number) => {
    const total = [...part].reduce((sum, item, index) => sum + Number(item) * (weight - index), 0);
    const result = 11 - (total % 11);
    return result > 9 ? 0 : result;
  };
  return (
    digit(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    digit(cpf.slice(0, 10), 11) === Number(cpf[10])
  );
}
