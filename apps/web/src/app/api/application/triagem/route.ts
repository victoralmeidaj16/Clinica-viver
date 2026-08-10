import { NextResponse } from 'next/server';
import type { TriagemPacienteRecord } from '@/server/application/persistence';
import {
  captureStateAsSnapshot,
  getCaptureRepository,
} from '@/server/persistence/captureRepository';
import { alocarLead, classificarSla, horasDesdeAlocacao, varrerSla } from '@/server/application/viverMaisRodizio';
import { avisarAlocacao, avisarTransbordo } from '@/server/application/viverMaisWhatsApp';
import { exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';
import { validateGender } from '@/lib/gender';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const genero = validateGender(body.genero, body.generoOutro);
    if (!genero) {
      return NextResponse.json(
        { success: false, error: 'Selecione o gênero e informe a descrição quando escolher Outro.' },
        { status: 400 }
      );
    }

    const novaTriagem: TriagemPacienteRecord = {
      id: `triagem-${Date.now()}`,
      protocolo: body.protocolo || `VM-${Math.floor(100000 + Math.random() * 900000)}`,
      nomePaciente: body.nome,
      telefone: body.whatsapp,
      idade: body.idade,
      email: body.email,
      cpf: body.cpf,
      cep: body.cep,
      possuiConvenio: body.possuiConvenio,
      convenioSelecionado: body.convenioSelecionado || 'Nenhum',
      origem: body.origem || 'Formulário Vitrine',
      turno: body.turno || 'VESPERTINO',
      servico: body.servico,
      servicoKey: body.servicoKey,
      modalidade: body.modalidade,
      genero: genero.gender,
      generoOutro: genero.other,
      status: 'PENDENTE_ATRIBUICAO',
      criadoEm: new Date().toISOString(),
    };

    // A alocação decide dentro da mutação: ler a fila, escolher o profissional
    // da vez e gravar precisam acontecer sem que outro formulário entre no meio
    // — dois pedidos simultâneos alocados a partir da mesma leitura cairiam no
    // mesmo psicólogo.
    const resultado = await getCaptureRepository().mutate((state) => {
      const snapshot = captureStateAsSnapshot(state);
      const alocado = alocarLead(
        {
          ...snapshot,
          triagensPacientes: [...(snapshot.triagensPacientes ?? []), novaTriagem],
        },
        novaTriagem
      );

      return {
        next: {
          triagensPacientes: alocado.snapshot.triagensPacientes ?? [],
          cadastrosPsicologos: alocado.snapshot.cadastrosPsicologos ?? [],
        },
        result: alocado,
      };
    });

    // Aviso depois de gravar, e sem travar a resposta ao paciente: a alocação
    // já está persistida, então uma falha de WhatsApp não perde o lead.
    if (resultado.psicologo) {
      void avisarAlocacao(resultado.lead, resultado.psicologo);
    } else {
      console.warn(
        `[triagem] Lead ${novaTriagem.protocolo} sem profissional elegível; aguardando decisão da gestão.`
      );
    }

    return NextResponse.json({
      success: true,
      protocolo: novaTriagem.protocolo,
      data: resultado.lead,
    });
  } catch (error) {
    console.error('Erro ao salvar triagem de paciente:', error);
    return NextResponse.json({ success: false, error: 'Falha ao salvar no banco.' }, { status: 500 });
  }
}

/**
 * Fila de triagem para o cockpit.
 *
 * A varredura do SLA roda aqui, antes de responder. É o que garante o
 * transbordo funcionando desde o primeiro dia, sem depender de agendador
 * nenhum: quem abre o cockpit paga o custo de manter a fila em dia. Quando um
 * cron for pendurado em `/api/application/triagem/sla-sweep`, os dois convivem
 * — a varredura é idempotente.
 */
export async function GET() {
  try {
    await exigirGestao();

    const varrido = await getCaptureRepository().mutate((state) => {
      const resultado = varrerSla(captureStateAsSnapshot(state));
      return {
        next: {
          triagensPacientes: resultado.snapshot.triagensPacientes ?? [],
          cadastrosPsicologos: resultado.snapshot.cadastrosPsicologos ?? [],
        },
        result: resultado,
      };
    });

    for (const transbordo of varrido.transbordos) {
      void avisarTransbordo(transbordo.lead, transbordo.psicologoNovo);
    }

    const fila = (varrido.snapshot.triagensPacientes ?? []).map((lead) => ({
      ...lead,
      slaStatus: classificarSla(lead.alocadoEm),
      horasDecorridas: horasDesdeAlocacao(lead.alocadoEm),
    }));

    return NextResponse.json({
      success: true,
      data: fila,
      transbordosExecutados: varrido.transbordos.length,
    });
  } catch (error) {
    if (error instanceof NaoAutorizadoError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Erro ao listar a fila de triagem:', error);
    return NextResponse.json({ success: false, error: 'Falha ao carregar a fila.' }, { status: 500 });
  }
}
