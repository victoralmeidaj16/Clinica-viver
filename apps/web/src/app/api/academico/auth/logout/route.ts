import { success } from '@/server/application/http';
import { endStudentSession } from '@/server/academic/studentAuth';

export const runtime = 'nodejs';

export async function POST() {
  await endStudentSession();
  return success({ authenticated: false });
}
