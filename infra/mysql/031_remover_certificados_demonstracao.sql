-- Remove registros fictícios que não devem aparecer no painel nem validar publicamente.
DELETE FROM clinica_certificados
 WHERE codigo IN ('yZV8anjS', 'VVR-DEMO-2026', 'VVR-TEST-3390')
    OR aluno_nome IN ('Marina Silva Santos', 'Carlos Eduardo Mendes', 'Juliana Rocha');
