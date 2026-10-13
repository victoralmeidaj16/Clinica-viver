import 'server-only';

import { failure } from '@/server/application/http';
import { requireActiveStudent } from './studentAuth';
import { StudentPortalService } from './studentPortalService';

export async function resolveStudentPortal(options: { allowPasswordChange?: boolean } = {}) {
  const student = await requireActiveStudent(options);
  return { student, service: new StudentPortalService() };
}

export const studentApiFailure = (error: unknown) => failure(error);
