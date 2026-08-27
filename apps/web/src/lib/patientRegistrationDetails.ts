export interface PatientAddress {
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export interface PatientRegistrationDetails {
  legalName: string;
  socialName?: string;
  phone: string;
  email: string;
  cpf: string;
  address: PatientAddress;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  registrationNotes?: string;
}

export interface PatientRegistrationUpdate {
  actorUserId: string;
  actorDisplayName?: string;
  updatedAt: string;
  changedFields: readonly string[];
}

export interface PatientRegistrationRecord extends PatientRegistrationDetails {
  patientId: string;
  displayName: string;
  lastRegistrationUpdate?: PatientRegistrationUpdate;
}

const CPF_WEIGHTS = [
  [10, 9, 8, 7, 6, 5, 4, 3, 2],
  [11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
] as const;

function validCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  return CPF_WEIGHTS.every((weights, digitIndex) => {
    const total = weights.reduce((sum, weight, index) => sum + Number(value[index]) * weight, 0);
    const remainder = (total * 10) % 11;
    return Number(value[9 + digitIndex]) === (remainder === 10 ? 0 : remainder);
  });
}

function cleanText(value: unknown, max: number): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

export type PatientRegistrationValidation =
  | { ok: true; data: PatientRegistrationDetails }
  | { ok: false; error: string };

/** Validação compartilhada pela criação e pela edição cadastral. */
export function validatePatientRegistrationDetails(body: Record<string, unknown>): PatientRegistrationValidation {
  const rawAddress = body.address && typeof body.address === 'object'
    ? body.address as Record<string, unknown>
    : body;
  const legalName = cleanText(body.legalName ?? body.nome ?? body.displayName, 255);
  const socialName = cleanText(body.socialName ?? body.nomeSocial, 255);
  const phone = String(body.phone ?? body.whatsapp ?? '').replace(/\D/g, '').slice(-11);
  const email = cleanText(body.email, 255).toLowerCase();
  const cpf = String(body.cpf ?? '').replace(/\D/g, '');
  const address: PatientAddress = {
    cep: String(rawAddress.cep ?? '').replace(/\D/g, ''),
    logradouro: cleanText(rawAddress.logradouro ?? rawAddress.ruaManual, 255),
    numero: cleanText(rawAddress.numero ?? rawAddress.numeroResidencia, 32),
    complemento: cleanText(rawAddress.complemento, 120) || undefined,
    bairro: cleanText(rawAddress.bairro ?? rawAddress.bairroManual, 120),
    cidade: cleanText(rawAddress.cidade, 120),
    uf: cleanText(rawAddress.uf ?? rawAddress.estadoUf, 2).toUpperCase(),
  };

  if (!legalName) return { ok: false, error: 'O nome completo é obrigatório.' };
  if (phone.length < 10) return { ok: false, error: 'Informe um telefone brasileiro válido.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Informe um e-mail válido.' };
  if (!validCpf(cpf)) return { ok: false, error: 'Informe um CPF válido.' };
  if (address.cep.length !== 8) return { ok: false, error: 'Informe um CEP com 8 dígitos.' };
  if (!address.logradouro || !address.numero || !address.bairro || !address.cidade || !/^[A-Z]{2}$/.test(address.uf)) {
    return { ok: false, error: 'Complete rua, número, bairro, cidade e estado.' };
  }

  return {
    ok: true,
    data: {
      legalName,
      socialName: socialName || undefined,
      phone,
      email,
      cpf,
      address,
      emergencyContactName: cleanText(body.emergencyContactName, 255) || undefined,
      emergencyContactPhone: String(body.emergencyContactPhone ?? '').replace(/\D/g, '').slice(-11) || undefined,
      registrationNotes: cleanText(body.registrationNotes, 2000) || undefined,
    },
  };
}

