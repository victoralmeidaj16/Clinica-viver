import { resolveRequestContext } from '@/server/application/context';
import { getGestaoAgenda } from '@/server/application/gestaoAgendaService';
import { failure, success } from '@/server/application/http';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const context = await resolveRequestContext(request);
    const params = new URL(request.url).searchParams;
    return success(await getGestaoAgenda(context, params.get('busca') ?? '', Number(params.get('pagina') ?? 0)));
  } catch (error) { return failure(error); }
}
