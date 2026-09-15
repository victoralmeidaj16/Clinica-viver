-- O fato de a empresa custear sessões é uma configuração do convênio,
-- não deve fazer parte do nome exibido para pacientes e gestão.
UPDATE clinica_convenios
   SET nome = 'Cristalcopo'
 WHERE nome = 'Cristalcopo (empresa paga as sessões)';
