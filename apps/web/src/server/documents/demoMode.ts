import 'server-only';
import { isMysqlConfigured } from '@/server/oci/runtime';

export function isDocumentDemo(): boolean {
  return process.env.NODE_ENV === 'development'
    && process.env.CLINICAL_DOCUMENTS_DEMO === 'true'
    && process.env.ORGANIZATION_ID === 'org-demo'
    && !isMysqlConfigured();
}
