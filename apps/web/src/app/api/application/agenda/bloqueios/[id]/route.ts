import { resolveRequestContext } from '@/server/application/context';
import { removeBlock } from '@/server/application/agendaService';
import { failure, success } from '@/server/application/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await resolveRequestContext(request);
    const { id } = await params;
    return success(await removeBlock(context, id));
  } catch (error) {
    return failure(error);
  }
}
