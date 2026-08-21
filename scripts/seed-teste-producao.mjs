import mysql from 'mysql2/promise';
import { createHash } from 'node:crypto';

function uuidDeterministico(chave) {
  const hex = createHash('sha256').update(chave).digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const valor = hex.join('');
  return `${valor.slice(0, 8)}-${valor.slice(8, 12)}-${valor.slice(12, 16)}-${valor.slice(16, 20)}-${valor.slice(20)}`;
}

function gerarCpfValido() {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 9));
  let d1 = n.reduce((acc, val, idx) => acc + val * (10 - idx), 0);
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;
  
  let d2 = [...n, d1].reduce((acc, val, idx) => acc + val * (11 - idx), 0);
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;

  return [...n, d1, d2].join('');
}

async function seed() {
  const connection = await mysql.createConnection(
    process.env.DATABASE_URL || 'mysql://root:dev-root-local@127.0.0.1:3307/viver_mais_clinica'
  );

  console.log('⚡ Conectado ao MySQL local viver_mais_clinica...');

  const orgSlug = 'viver-mais-psicologia';
  const orgRef = 'org-viver-mais';
  const instId = uuidDeterministico(`instituicao:${orgSlug}`);
  const orgId = uuidDeterministico(`organizacao:${orgSlug}:${orgRef}`);

  // 1. Instituição
  await connection.execute(`
    INSERT INTO instituicoes (id, slug, nome)
    VALUES (?, ?, 'Viver Mais Psicologia')
    ON DUPLICATE KEY UPDATE nome = VALUES(nome)
  `, [instId, orgSlug]);

  // 2. Organização
  await connection.execute(`
    INSERT INTO clinica_organizacoes 
      (id, instituicao_id, ref_core, tipo, nome_exibicao, razao_social, timezone, status)
    VALUES (?, ?, ?, 'clinic', 'Viver Mais Psicologia', 'Viver Mais Psicologia', 'America/Sao_Paulo', 'active')
    ON DUPLICATE KEY UPDATE nome_exibicao = VALUES(nome_exibicao)
  `, [orgId, instId, orgRef]);

  // 3. Usuário Admin / Coordenação
  const adminUserRef = 'usr-coordenacao';
  const adminUserId = uuidDeterministico(`usuario:${orgSlug}:${adminUserRef}`);
  await connection.execute(`
    INSERT INTO clinica_usuarios (id, instituicao_id, ref_core, nome_exibicao, email_normalizado, status, senha_definida_em)
    VALUES (?, ?, ?, 'Coordenação Viver Mais', 'admin@vivermais.local', 'active', NOW())
    ON DUPLICATE KEY UPDATE nome_exibicao = VALUES(nome_exibicao), status = VALUES(status)
  `, [adminUserId, instId, adminUserRef]);

  const adminMemberRef = 'membership-coordenacao';
  const adminMemberId = uuidDeterministico(`membro:${orgSlug}:${adminMemberRef}`);
  await connection.execute(`
    INSERT INTO clinica_membros (id, instituicao_id, organizacao_id, ref_core, usuario_ref, papeis, status, profissional_id)
    VALUES (?, ?, ?, ?, ?, 'owner,admin,billing', 'active', NULL)
    ON DUPLICATE KEY UPDATE papeis = VALUES(papeis), status = VALUES(status)
  `, [adminMemberId, instId, orgId, adminMemberRef, adminUserRef]);

  // 4. Psicólogo Victor Almeida
  const profUserRef = 'usr-victor-almeida';
  const profUserId = uuidDeterministico(`usuario:${orgSlug}:${profUserRef}`);
  await connection.execute(`
    INSERT INTO clinica_usuarios (id, instituicao_id, ref_core, nome_exibicao, email_normalizado, status, senha_definida_em)
    VALUES (?, ?, ?, 'Victor Almeida', 'victor@vivermais.cloud', 'active', NOW())
    ON DUPLICATE KEY UPDATE nome_exibicao = VALUES(nome_exibicao), status = VALUES(status)
  `, [profUserId, instId, profUserRef]);

  const profRef = 'prof-victor-almeida';
  const profId = uuidDeterministico(`profissional:${orgSlug}:${profRef}`);
  const tokenAgenda = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
  const tokenPagamento = 'f1e2d3c4b5a697887766554433221100';

  await connection.execute(`
    INSERT INTO clinica_profissionais 
      (id, instituicao_id, organizacao_id, ref_core, usuario_ref, nome, crp, vinculo, 
       telefone, email, valor_sessao_centavos, valor_social_centavos, aceita_novos, 
       token_link_agenda, token_link_pagamento, ativo)
    VALUES (?, ?, ?, ?, ?, 'Victor Almeida', '12/34567', 'psicologo', 
            '48999955531', 'victor@vivermais.cloud', 500, 500, 1, 
            ?, ?, 1)
    ON DUPLICATE KEY UPDATE 
      nome = VALUES(nome),
      valor_sessao_centavos = 500,
      valor_social_centavos = 500,
      token_link_agenda = VALUES(token_link_agenda),
      token_link_pagamento = VALUES(token_link_pagamento),
      ativo = 1
  `, [profId, instId, orgId, profRef, profUserRef, tokenAgenda, tokenPagamento]);

  const profMemberRef = 'membership-victor-almeida';
  const profMemberId = uuidDeterministico(`membro:${orgSlug}:${profMemberRef}`);
  await connection.execute(`
    INSERT INTO clinica_membros (id, instituicao_id, organizacao_id, ref_core, usuario_ref, papeis, status, profissional_id)
    VALUES (?, ?, ?, ?, ?, 'professional', 'active', ?)
    ON DUPLICATE KEY UPDATE status = VALUES(status), profissional_id = VALUES(profissional_id)
  `, [profMemberId, instId, orgId, profMemberRef, profUserRef, profId]);

  // 5. Cadastro Psicólogo (Captação / Vitrine)
  const cadPsiId = uuidDeterministico(`cadastro_psi:${orgSlug}:${profRef}`);
  await connection.execute(`
    INSERT INTO clinica_cadastros_psicologos 
      (id, instituicao_id, organizacao_ref, ref_core, usuario_ref, nome_completo, crp, whatsapp, email, 
       cidade_uf, estado_uf, cidade, status, turnos_disponiveis, modalidades_atendidas, 
       servicos_habilitados, exibir_na_vitrine, limite_pacientes_ativos)
    VALUES (?, ?, ?, ?, ?, 'Victor Almeida', '12/34567', '48999955531', 'victor@vivermais.cloud',
            'Tubarão/SC', 'SC', 'Tubarão', 'APROVADO', '["manha","tarde","noite"]', '["ONLINE","PRESENCIAL"]',
            '["PSICOTERAPIA"]', 1, 20)
    ON DUPLICATE KEY UPDATE status = 'APROVADO'
  `, [cadPsiId, instId, orgRef, profRef, profUserRef]);

  // 6. Disponibilidades do Psicólogo (Segunda a Sexta, 08:00 às 18:00)
  for (let dia = 1; dia <= 5; dia++) {
    const dispId = uuidDeterministico(`disp:${orgSlug}:${profRef}:${dia}`);
    await connection.execute(`
      INSERT INTO clinica_disponibilidades 
        (id, instituicao_id, profissional_id, dia_semana, hora_inicio, hora_fim, modalidade)
      VALUES (?, ?, ?, ?, '08:00:00', '18:00:00', 'online')
      ON DUPLICATE KEY UPDATE hora_inicio = '08:00:00', hora_fim = '18:00:00'
    `, [dispId, instId, profId, dia]);
  }

  // 7. Paciente de Teste com CPF matematicamente válido
  const cpfPaciente = gerarCpfValido();
  const pacienteRef = 'paciente-teste-prod';
  const pacienteId = uuidDeterministico(`paciente:${orgSlug}:${pacienteRef}`);
  const pacienteNome = 'Maria da Silva Teste';

  await connection.execute(`
    INSERT INTO clinica_pacientes 
      (id, instituicao_id, organizacao_id, ref_core, nome, status, profissional_id, telefone, email)
    VALUES (?, ?, ?, ?, ?, 'ativo', ?, '48999955531', 'financeiro.viverpsicologia@gmail.com')
    ON DUPLICATE KEY UPDATE nome = VALUES(nome), profissional_id = VALUES(profissional_id)
  `, [pacienteId, instId, orgId, pacienteRef, pacienteNome, profId]);

  // Vínculo Paciente - Profissional
  await connection.execute(`
    INSERT IGNORE INTO clinica_pacientes_profissionais (paciente_id, profissional_id)
    VALUES (?, ?)
  `, [pacienteId, profId]);

  // Triagem do Paciente (onde o link de agendamento e pagamento buscam o CPF)
  const triagemId = uuidDeterministico(`triagem:${orgSlug}:${pacienteRef}`);
  await connection.execute(`
    INSERT INTO clinica_triagens_pacientes 
      (id, instituicao_id, organizacao_ref, ref_core, protocolo, nome_paciente, telefone, email, cpf, 
       cep, possui_convenio, convenio_selecionado, origem, turno, servico, servico_key, modalidade,
       especificar_necessidades, necessidades_paciente, status, paciente_ref, psicologo_alocado_id,
       psicologo_nome, psicologos_ja_tentados)
    VALUES (?, ?, ?, ?, 'PROT-TESTE-01', ?, '48999955531', 'financeiro.viverpsicologia@gmail.com', ?,
            '88701150', 'NAO', 'PARTICULAR', 'TESTE_PROD', 'tarde', 'Atendimento Psicológico', 'PSICOTERAPIA',
            'online', 0, '[]', 'FINALIZADO', ?, ?, 'Victor Almeida', '[]')
    ON DUPLICATE KEY UPDATE 
      nome_paciente = VALUES(nome_paciente),
      cpf = VALUES(cpf),
      paciente_ref = VALUES(paciente_ref),
      psicologo_alocado_id = VALUES(psicologo_alocado_id),
      psicologos_ja_tentados = '[]'
  `, [triagemId, instId, orgRef, pacienteRef, pacienteNome, cpfPaciente, pacienteRef, cadPsiId]);

  console.log('✅ Dados de teste provisionados com sucesso:');
  console.log('--------------------------------------------------');
  console.log(`👨‍⚕️ Psicólogo: Victor Almeida`);
  console.log(`🔑 Token de Agendamento: ${tokenAgenda}`);
  console.log(`🔗 Link de Agendamento: http://localhost:3000/agendar/${tokenAgenda}`);
  console.log(`🔑 Token de Pagamento:   ${tokenPagamento}`);
  console.log(`🔗 Link de Pagamento:   http://localhost:3000/pagar/${tokenPagamento}`);
  console.log(`💵 Valor configurado:   R$ 5,00 (500 centavos)`);
  console.log('--------------------------------------------------');
  console.log(`👤 Paciente: ${pacienteNome}`);
  console.log(`📄 CPF Gerado (Válido): ${cpfPaciente}`);
  console.log('--------------------------------------------------');

  await connection.end();
}

seed().catch(console.error);
