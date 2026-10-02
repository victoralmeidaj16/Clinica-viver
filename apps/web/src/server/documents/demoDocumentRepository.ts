import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { link, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { IssuedPsychologicalDocument } from '@thats-life/core';
import type { DocumentRepository, DocumentScope } from './documentRepository';
import { encryptDocument, decryptDocument } from './documentEncryption';
import { isDocumentDemo } from './demoMode';

export class DemoDocumentRepository implements DocumentRepository {
  private directory(scope: DocumentScope) {
    if (!isDocumentDemo() || scope.organizationId !== 'org-demo') throw new Error('Repositório disponível somente na demonstração local.');
    const scopeKey = createHash('sha256').update(JSON.stringify(scope)).digest('hex');
    return join(process.env.CLINICAL_DOCUMENTS_DEMO_DIR || join(process.cwd(), '.demo-state', 'documents'), scopeKey);
  }

  private file(scope: DocumentScope, id: string) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('Identificador de documento inválido.');
    return join(this.directory(scope), `${id}.enc`);
  }

  async get(scope: DocumentScope, id: string): Promise<IssuedPsychologicalDocument | null> {
    try {
      const data = await readFile(this.file(scope, id), 'utf8');
      return decryptDocument<IssuedPsychologicalDocument>(data, JSON.stringify([scope, id]));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async list(scope: DocumentScope): Promise<IssuedPsychologicalDocument[]> {
    let files: string[];
    try { files = await readdir(this.directory(scope)); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const documents = await Promise.all(files.filter((file) => /^[a-f0-9]{64}\.enc$/.test(file)).map((file) => this.get(scope, file.slice(0, -4))));
    return documents.filter((document): document is IssuedPsychologicalDocument => document !== null).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  }

  async save(scope: DocumentScope, document: IssuedPsychologicalDocument) {
    const target = this.file(scope, document.id);
    const temporary = `${target}.${randomUUID()}.tmp`;
    await mkdir(this.directory(scope), { recursive: true, mode: 0o700 });
    const encrypted = encryptDocument(document, JSON.stringify([scope, document.id]));
    try {
      await writeFile(temporary, encrypted, { mode: 0o600, flag: 'wx' });
      // O link publica o arquivo completo sem substituir uma emissão concorrente.
      try { await link(temporary, target); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    } finally { await unlink(temporary).catch(() => {}); }
    const saved = await this.get(scope, document.id);
    if (!saved) throw new Error('Não foi possível recuperar o documento de teste.');
    return saved;
  }
}
