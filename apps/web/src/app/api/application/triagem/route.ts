import { NextResponse } from 'next/server';
import {
  emptySnapshot,
  readSnapshot,
  writeSnapshot,
  type TriagemPacienteRecord,
} from '@/server/application/persistence';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const snapshot = readSnapshot() ?? emptySnapshot();

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
      origem: body.origem || 'Facebook',
      turno: body.turno || 'VESPERTINO',
      servico: body.servico,
      modalidade: body.modalidade,
      status: 'PENDENTE_ATRIBUICAO',
      criadoEm: new Date().toISOString(),
    };

    const triagensAtualizadas = [
      ...(snapshot.triagensPacientes ?? []),
      novaTriagem,
    ];

    await writeSnapshot({
      ...snapshot,
      savedAt: new Date().toISOString(),
      triagensPacientes: triagensAtualizadas,
    });

    // Disparo automático via Evolution API (WhatsApp do Psicólogo)
    try {
      const evoUrl = process.env.EVOLUTION_API_URL;
      const evoApiKey = process.env.EVOLUTION_API_KEY;
      const evoInstance = process.env.EVOLUTION_INSTANCE_NAME;

      const psiTelefone = process.env.PSICOLOGO_FILA_WHATSAPP || body.whatsapp; // Se não configurado envia para o número de teste
      const textoWhatsApp = `Olá, Dr. Lucas! 🧠✨\n\nVocê recebeu um novo paciente de *${body.servico || 'Psicoterapia'}* (${body.modalidade || 'Social'}) no turno da *${body.turno || 'Tarde'}*.\n\n👤 *Paciente:* ${body.nome}\n📱 *WhatsApp:* ${body.whatsapp}\n\nClique no link abaixo para confirmar o atendimento e gerar o link de pagamento em até 24h:\nhttps://vivermaispsicologia.com.br/cockpit`;

      if (evoUrl && evoApiKey && evoInstance) {
        fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evoApiKey,
          },
          body: JSON.stringify({
            number: psiTelefone.replace(/\D/g, ''),
            text: textoWhatsApp,
          }),
        }).catch((err) => console.warn('[EvolutionAPI Disparo] Servidor offline ou desconfigurado:', err));
      } else {
        console.warn('[EvolutionAPI Disparo] Variáveis de ambiente não configuradas.');
      }
    } catch (e) {
      console.warn('[EvolutionAPI Notification] Ignorado:', e);
    }

    return NextResponse.json({
      success: true,
      protocolo: novaTriagem.protocolo,
      data: novaTriagem,
    });
  } catch (error) {
    console.error('Erro ao salvar triagem de paciente:', error);
    return NextResponse.json({ success: false, error: 'Falha ao salvar no banco.' }, { status: 500 });
  }
}
