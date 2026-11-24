import { listEducationalCreditLines } from '@thats-life/core';
import { ApplicationError, failure, success } from '@/server/application/http';
import { resolveRequestContext } from '@/server/application/context';
import { getApplicationStore } from '@/server/application/store';
import { arquivoApuracao, origensCredito, periodoCompetencia } from '@/server/reports/educationalCreditReport';

export async function GET(request: Request) {
  try {
    const { actor } = await resolveRequestContext(request);
    if (!actor.roles.some(r => r === 'admin' || r === 'owner' || r === 'billing')
        || (actor.roles.includes('professional') && !actor.roles.some(r => r === 'admin' || r === 'owner'))) {
      throw new ApplicationError('FORBIDDEN', 'Acesso exclusivo da Gestão e do Financeiro.', 403);
    }
    const params = new URL(request.url).searchParams;
    const mes = params.get('mes') ?? '';
    const pro = params.get('profissional');
    const filter = { ...periodoCompetencia(mes), organizationId: actor.organizationId, professionalIds: pro ? [pro] : undefined };
    const { financial, identities } = getApplicationStore();
    const credits = financial.listPersistedCredits ? await financial.listPersistedCredits(actor.organizationId, filter)
      : listEducationalCreditLines(await financial.getLedger({ organizationId: actor.organizationId }), filter);
    const names = new Map(await Promise.all([...new Set(credits.map(l => l.professionalId))].map(async id =>
      [id, (await identities.getProfessional(actor.organizationId, id))?.displayName ?? id] as const)));
    const linhas = credits.map(l => ({ ...l, profissional: names.get(l.professionalId)!, origem: origensCredito[l.source] }));
    const report = { mes, linhas, totalCentavos: linhas.reduce((n, l) => n + l.creditCents, 0) };
    const formato = params.get('formato');
    if (!formato) return success(report);
    if (formato !== 'pdf' && formato !== 'xlsx') throw new ApplicationError('INVALID_INPUT', 'Formato inválido.', 400);
    return new Response(new Uint8Array(await arquivoApuracao(report, formato)), { headers: {
      'Content-Type': formato === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Cache-Control': 'no-store', 'Content-Disposition': `attachment; filename="creditos-${mes}.${formato}"`,
    } });
  } catch (error) { return failure(error); }
}
