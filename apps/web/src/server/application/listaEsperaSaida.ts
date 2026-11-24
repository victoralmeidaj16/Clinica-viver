import { naListaDeEspera, type EventoListaEspera, type MotivoSaidaListaEspera } from '@/lib/listaEspera';
import { inativacaoVigente } from '@/lib/inativacaoVinculo';
import type { TriagemPacienteRecord } from './persistence';

/**
 * Fecha a permanência na lista de espera de quem deixou de esperar.
 *
 * Fica separado do rodízio porque é chamado em `recalcularPacientesAtivos`, por
 * onde toda mutação da fila passa: aceite, vínculo direto, desistência e
 * inativação encerram a espera sem que cada uma dessas rotas precise lembrar.
 * Idempotente — uma permanência já fechada não muda.
 */
export function encerrarEsperaSeAtendido(lead: TriagemPacienteRecord): TriagemPacienteRecord {
  if (!naListaDeEspera(lead) || !lead.listaEspera) return lead;
  const saida = motivoDeSaida(lead);
  if (!saida) return lead;
  const evento: EventoListaEspera = { tipo: 'SAIDA', em: saida.em, detalhe: saida.motivo };
  return {
    ...lead,
    listaEspera: {
      ...lead.listaEspera,
      saidaEm: saida.em,
      motivoSaida: saida.motivo,
      eventos: [...lead.listaEspera.eventos, evento],
    },
  };
}

function motivoDeSaida(lead: TriagemPacienteRecord): { motivo: MotivoSaidaListaEspera; em: string } | undefined {
  const agora = new Date().toISOString();
  if (lead.status === 'INATIVO') return { motivo: 'INATIVACAO', em: inativacaoVigente(lead)?.inativadoEm ?? agora };
  if (lead.status === 'DESISTENTE') return { motivo: 'DESISTENCIA', em: agora };
  if (lead.status === 'FINALIZADO') return { motivo: 'ENCERRADO', em: agora };
  if (lead.status === 'CONTATO_CONFIRMADO') {
    // Confirmado sem aceite anterior é vínculo direto da Gestão; com aceite, o
    // psicólogo aceitou e depois confirmou o contato.
    const direto = !lead.aceitoEm || lead.aceitoEm === lead.confirmadoEm;
    return { motivo: direto ? 'VINCULO_DIRETO' : 'ACEITE', em: lead.aceitoEm ?? lead.confirmadoEm ?? agora };
  }
  if (lead.status === 'AGUARDANDO_CONTATO' && lead.aceitoEm) return { motivo: 'ACEITE', em: lead.aceitoEm };
  return undefined;
}

/**
 * Oferta que nasceu da lista e não encontrou quem aceitasse volta a esperar,
 * com a data de entrada original. Sem isso, a recusa sem substituto deixaria o
 * paciente preso a quem recusou, fora da lista e fora do rodízio.
 */
export function devolverParaEspera(
  lead: TriagemPacienteRecord,
  agora: Date,
  detalhe: string
): TriagemPacienteRecord {
  if (!naListaDeEspera(lead) || !lead.listaEspera) return lead;
  return {
    ...lead,
    status: 'PENDENTE_ATRIBUICAO',
    psicologoAlocadoId: undefined,
    psicologoNome: undefined,
    alocadoEm: undefined,
    aceitoEm: undefined,
    prazoRespostaHoras: undefined,
    slaExpirado: false,
    listaEspera: {
      ...lead.listaEspera,
      eventos: [...lead.listaEspera.eventos, { tipo: 'RETORNO', em: agora.toISOString(), detalhe }],
    },
  };
}
