import { resolveRequestContext } from '@/server/application/context';
import { getMyFinancialData } from '@/server/application/financialService';
import { failure, success } from '@/server/application/http';
import { getProfessionalPaymentProfile } from '@/server/payments/paymentLinkRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function dateBoundary(value: string | null, end: boolean): string | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return `${value}T${end ? '23:59:59.999' : '00:00:00.000'}-03:00`;
}

export async function GET(request: Request) {
  try {
    const context = await resolveRequestContext(request);
    const professionalId = context.actor.professionalProfileId;
    if (!professionalId) throw new Error('Perfil profissional não encontrado para este acesso.');
    const { searchParams } = new URL(request.url);
    const financial = await getMyFinancialData(context, {
      startDate: dateBoundary(searchParams.get('startDate'), false),
      endDate: dateBoundary(searchParams.get('endDate'), true),
    });
    const paymentProfile = await getProfessionalPaymentProfile(
      context.actor.organizationId,
      professionalId
    );
    if (!paymentProfile) throw new Error('Perfil profissional ativo não encontrado.');
    return success({
      professionalName: paymentProfile.professionalName,
      paymentToken: paymentProfile.token,
      modalities: {
        social: paymentProfile.socialCents,
        particular: paymentProfile.privateCents,
      },
      ...financial,
    });
  } catch (error) {
    return failure(error);
  }
}
