import { useState } from 'react';
import { normalizeBrazilPhone } from '@/lib/brazilPhone';
import { validateGender } from '@/lib/gender';
import { opcoesAtendimentoDaPos } from './opcoesPsicologo';
import { VERSAO_TERMOS_PARCERIA } from './ModalTermosParceria';
import { CADASTRO_PSICOLOGO_INICIAL } from './cadastroPsicologoFormState';
import type { CadastroPsicologoCriado } from './CadastroPsicologoForm';

export function useCadastroPsicologoForm(onSucesso: (cadastro: CadastroPsicologoCriado) => void | Promise<void>) {
  const [temNomeSocialPsicologo, setTemNomeSocialPsicologo] = useState(false);
  const [temSegundaPos, setTemSegundaPos] = useState(false);
  const [segundaPosGraduacao, setSegundaPosGraduacao] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cadastroExistente, setCadastroExistente] = useState<string | null>(null);
  const [modalTermosAberto, setModalTermosAberto] = useState(false);
  const [aceitouTermos, setAceitouTermos] = useState(false);

  const [formPsicologo, setFormPsicologo] = useState(CADASTRO_PSICOLOGO_INICIAL);

  const handleSubmitPsicologo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setCadastroExistente(null);
    if (!formPsicologo.fotoUrl.trim()) {
      alert('Envie uma foto de perfil para concluir o cadastro.');
      return;
    }
    if (!normalizeBrazilPhone(formPsicologo.whatsapp)) {
      alert('Informe um telefone brasileiro válido com DDD.');
      return;
    }
    if (!formPsicologo.estadoUf || !formPsicologo.cidade) {
      alert('Selecione o estado e uma cidade da lista.');
      return;
    }
    if (!formPsicologo.logradouro.trim() || !formPsicologo.bairro.trim()) {
      alert('Informe rua/logradouro e bairro.');
      return;
    }
    if (!validateGender(formPsicologo.genero, formPsicologo.generoOutro)) {
      alert('Selecione o gênero e, se escolher Outro, informe a descrição.');
      return;
    }
    const opcoesAtendimento = opcoesAtendimentoDaPos(
      formPsicologo.posGraduacaoViverMais,
      temSegundaPos ? segundaPosGraduacao : undefined
    );
    const servicosSelecionados = opcoesAtendimento
      ? formPsicologo.servicosPrestados.filter((servico) => opcoesAtendimento.servicos.includes(servico))
      : formPsicologo.servicosPrestados;
    const publicoSelecionado = opcoesAtendimento
      ? formPsicologo.publicoAlvo.filter((publico) => opcoesAtendimento.publico.includes(publico))
      : formPsicologo.publicoAlvo;
    const temposSelecionados = formPsicologo.temposAtendimento.filter((tempo) => opcoesAtendimento?.tempos.includes(tempo));
    if (opcoesAtendimento?.tempos.length && !temposSelecionados.length) {
      alert('Selecione ao menos um tempo de atendimento.');
      return;
    }
    if (opcoesAtendimento && servicosSelecionados.length === 0) {
      alert('Selecione ao menos um serviço prestado.');
      return;
    }
    if (opcoesAtendimento && publicoSelecionado.length === 0) {
      alert('Selecione ao menos um público alvo.');
      return;
    }
    if (formPsicologo.disponibilidadeTurnos.length === 0) {
      alert('Selecione ao menos um turno de atendimento.');
      return;
    }
    if (!aceitouTermos) {
      alert('Por favor, leia e aceite o Termo de Adesão e Condições de Uso antes de enviar seu cadastro.');
      setModalTermosAberto(true);
      return;
    }
    setIsSubmitting(true);
    try {
      const resp = await fetch('/api/application/credenciamento-psicologo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formPsicologo,
          temposAtendimento: opcoesAtendimento?.tempos.length ? temposSelecionados : undefined,
          ...(opcoesAtendimento
            ? {
                servicosPrestados: servicosSelecionados,
                publicoAlvo: publicoSelecionado,
              }
            : {}),
          segundaPosGraduacao: temSegundaPos ? segundaPosGraduacao : undefined,
          aceitouTermos: true,
          aceitouTermosEm: new Date().toISOString(),
          versaoTermos: VERSAO_TERMOS_PARCERIA,
        }),
      });
      const data = (await resp.json()) as { success: boolean; code?: string; error?: string; data?: CadastroPsicologoCriado };
      if (data.success) {
        await onSucesso(data.data ?? ({ id: '' } as CadastroPsicologoCriado));
      } else if (resp.status === 409 && data.code === 'CADASTRO_DUPLICADO') {
        setCadastroExistente(formPsicologo.email.trim());
      } else {
        alert(data.error ?? 'Erro ao cadastrar psicólogo. Tente novamente.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao enviar credenciamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return { formPsicologo, setFormPsicologo, temNomeSocialPsicologo, setTemNomeSocialPsicologo,
    temSegundaPos, setTemSegundaPos, segundaPosGraduacao, setSegundaPosGraduacao,
    isSubmitting, cadastroExistente, modalTermosAberto, setModalTermosAberto,
    aceitouTermos, setAceitouTermos, handleSubmitPsicologo };
}
