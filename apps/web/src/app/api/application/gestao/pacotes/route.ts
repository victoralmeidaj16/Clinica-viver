import { resolveRequestContext } from '@/server/application/context';
import { failure, readJson, success } from '@/server/application/http';
import { criarPacote, emitirPacote, listarPacotes } from '@/server/application/patientPackageService';

export async function GET(request: Request) {
  try { return success(await listarPacotes(await resolveRequestContext(request))); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const context = await resolveRequestContext(request,true);
    const body = await readJson(request);
    return success(body.action === 'emitir' ? await emitirPacote(context,String(body.id)) : await criarPacote(context,body));
  } catch (error) { return failure(error); }
}
