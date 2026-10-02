import { resolveRequestContext } from '@/server/application/context';
import { ApplicationError, failure, readJson, success } from '@/server/application/http';
import { documentService } from '@/server/documents/documentService';
import { parseDocumentInput } from '@/server/documents/documentInput';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, route: RouteContext) {
  try {
    const context = await resolveRequestContext(request);
    const { id } = await route.params;
    return success(new URL(request.url).searchParams.get('view') === 'options'
      ? await documentService.options(context, id) : await documentService.list(context, id));
  } catch (error) { return failure(error); }
}

export async function POST(request: Request, route: RouteContext) {
  try {
    const context = await resolveRequestContext(request);
    const { id } = await route.params;
    const body = await readJson(request);
    if (body?.action === 'preview') return success(await documentService.preview(context, id, parseDocumentInput(body)));
    if (body?.action === 'issue') return success(await documentService.issue(context, id, body), 201);
    throw new ApplicationError('INVALID_INPUT', 'Operação inválida.', 400);
  } catch (error) { return failure(error); }
}
