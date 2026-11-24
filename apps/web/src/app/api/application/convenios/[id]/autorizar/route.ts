import { autorizarExcedente } from '@/server/application/convenioAutorizacao';
import { resolveRequestContext } from '@/server/application/context';
import { failure, readJson, success } from '@/server/application/http';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await resolveRequestContext(request,true);
    return success(await autorizarExcedente(ctx,(await params).id,String((await readJson(request)).agendamentoId)));
  } catch (error) { return failure(error); }
}
