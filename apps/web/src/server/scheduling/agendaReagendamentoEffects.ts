import 'server-only';
import { getContatosDaSessao } from './agendaRepository';
import { avisarSessaoRemarcada } from './agendaAvisos';
import { processAppointmentChargeDue } from '@/server/payments/sessionChargeDueWorker';

/** Chamado somente depois do commit. Falhas externas não desfazem a marcação. */
export async function concluirReagendamento(input: {
  id: string; inicioAnterior: string; inicio: string; fim: string; versao: number;
  modalidade?: 'online' | 'presencial' | 'telefone';
}) {
  await Promise.all([
    processAppointmentChargeDue(input.id),
    (async () => {
      try {
        const contatos = await getContatosDaSessao(input.id);
        if (contatos) await avisarSessaoRemarcada({ ...contatos, inicio: input.inicio, fim: input.fim,
          modalidade: input.modalidade ?? contatos.modalidade }, input.inicioAnterior, input.versao);
      } catch (error) { console.error('[agenda] Remarcação confirmada, mas o aviso falhou:', error); }
    })(),
  ]);
}
