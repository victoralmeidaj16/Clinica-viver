/** CPF atual do cadastro (alias pa). A triagem só é fallback quando não há documento. */
export const CPF_CADASTRO_SQL = "NULLIF(REPLACE(REPLACE(REPLACE(COALESCE(pa.documento, ''), '.', ''), '-', ''), ' ', ''), '')";
