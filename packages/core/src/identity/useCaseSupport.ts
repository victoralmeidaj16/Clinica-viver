import type { IdentityAuditPort, IdentityRepository } from './ports';

export interface IdentityUseCaseDependencies {
  repository: IdentityRepository;
  audit?: IdentityAuditPort;
}

export async function appendIdentityAudit(
  dependencies: IdentityUseCaseDependencies,
  input: Parameters<IdentityAuditPort['append']>[0]
): Promise<void> {
  await dependencies.audit?.append(input);
}
