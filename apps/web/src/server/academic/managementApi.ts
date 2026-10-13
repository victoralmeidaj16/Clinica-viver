import 'server-only';

import { readSession } from '@/server/auth';
import { ApplicationError, failure } from '@/server/application/http';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import { exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';
import { AcademicManagementService } from './academicManagementService';

export async function resolveAcademicManager(): Promise<{ actorUserId: string; service: AcademicManagementService }> {
  await exigirGestao();
  const session = await readSession();
  if (!session || session.role !== 'admin') throw new ApplicationError('UNAUTHENTICATED', 'Faça login para continuar.', 401);
  return { actorUserId: session.userId, service: new AcademicManagementService(undefined, instituicaoId()) };
}

export function academicApiFailure(error: unknown) {
  if (error instanceof NaoAutorizadoError) {
    return failure(new ApplicationError(error.status === 401 ? 'UNAUTHENTICATED' : 'FORBIDDEN', error.message, error.status));
  }
  return failure(error);
}

export const stringValue = (value: unknown) => typeof value === 'string' ? value : '';
export const numberValue = (value: unknown) => typeof value === 'number' ? value : Number(value ?? 0);
export const booleanValue = (value: unknown) => value === true;
