import { endSession } from '@/server/auth';
import { success } from '@/server/application/http';

export const runtime = 'nodejs';

export async function POST() {
  await endSession();
  return success({ authenticated: false });
}
