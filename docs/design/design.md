# Design System & Identidade Visual — Plataforma Viver +

Guia de estilo da **Plataforma Viver +** (Viver Mais Psicologia): cores, tipografia, superfícies e padrões de componentes.

- **Atualizado em:** 24/11/2026, a partir do código.
- **Fonte da verdade dos tokens:** [tailwind.config.js](../../apps/web/tailwind.config.js) e [globals.css](../../apps/web/src/app/globals.css). Se este documento e o código divergirem, vale o código; corrija o documento.
- **Página de referência:** **Agenda & Horários do psicólogo** ([`/agenda`](../../apps/web/src/app/agenda/page.tsx)). Para criar ou revisar uma tela, use os componentes dela como modelo:
  - [AgendaShareCard](../../apps/web/src/components/scheduling/AgendaShareCard.tsx)
  - [AvailabilitySummary](../../apps/web/src/components/scheduling/AvailabilitySummary.tsx)
  - [AvailabilitySummaryContent](../../apps/web/src/components/scheduling/AvailabilitySummaryContent.tsx)
  - [AgendaTabs](../../apps/web/src/components/scheduling/AgendaTabs.tsx)

---

## 1. Paleta da marca

A plataforma é **monocromática em roxo**: a hierarquia vem de tons de uma mesma família, não de cores diferentes. As outras cores só aparecem para comunicar estado (seção 2).

### Roxos (`psi-*`)

| Token Tailwind | Hex | Uso |
| :--- | :--- | :--- |
| `psi-darkest` | `#43265E` | Sidebar, blocos de alto contraste (card "Link de agendamento"), aba ativa, títulos de card (`text-psi-darkest`) |
| `psi-deep` | `#5C397D` | Botão primário (`btn-primary`), ícones de dados, links de texto |
| `psi-vibrant` | `#9E6BCF` | Botão de destaque (`btn-accent`, ex.: "Agendar sessão"), item ativo do menu, ícone ao lado do título da página, anel de foco |
| `psi-soft` | `#EDE6F4` | Bordas de botões e campos, chips, contadores, hover |
| `psi-light` | `#F9F5FC` | Mesmo valor do `canvas`: fundo levemente lilás |

Os aliases `primary`, `accent` e `capri` existem no Tailwind, mas apontam para esses mesmos roxos. **Não há laranja nem azul na marca**: os antigos "Carrot Orange" `#F99E29` e "Capri Blue" `#00C1FF` não são usados. Prefira os nomes `psi-*`.

### Neutros e superfícies

| Token | Hex | Uso |
| :--- | :--- | :--- |
| `ink` | `#1E1528` | Texto principal e títulos de página |
| `muted` | `#756785` | Textos secundários, legendas, rótulos de dados |
| `surface` | `#FFFFFF` | Cards, modais, barra de abas |
| `canvas` | `#F9F5FC` | Fundo da aplicação; hover de itens dentro de cards |
| `line` | `#F0E9F5` | Bordas de cards e divisores |

Dois tons fora dos tokens aparecem na página de referência:
- `#F7F3FB`: fundo da faixa de dados do resumo.
- `#E6DCF0`: divisórias dessa faixa.

Ao reutilizar, mantenha esses valores ou promova-os a token; não invente variações próximas.

---

## 2. Cores de estado

Cores fora do roxo só servem para dizer **em que situação algo está**, nunca para decorar ou diferenciar seções. O padrão é fundo claro, borda suave e texto escuro do mesmo tom:

| Estado | Classes | Exemplo |
| :--- | :--- | :--- |
| Erro / falha | `border-rose-200 bg-rose-50 text-rose-700` | Falha ao carregar a agenda |
| Aviso / atenção | `border-amber-200 bg-amber-50 text-amber-900` | Aviso no resumo da disponibilidade |
| Ação destrutiva (hover) | `hover:bg-rose-50 hover:text-rose-600` | Remover um intervalo da grade |

### Tags e indicadores de status: base neutra, cor só no ícone

Tags ("Turma 25A") e indicadores de status ("Indisponível", "Conta ativada", "Folga") usam **a mesma base neutra do botão "Pausar"**:
- fundo branco;
- borda cinza discreta;
- texto escuro.

A cor aparece **só no ícone**, e só quando ajuda a reconhecer o estado. Implementação em [TagStatus.tsx](../../apps/web/src/components/gestao/TagStatus.tsx):

```tsx
const TAG_NEUTRA = 'border border-slate-200 bg-white text-slate-700';

<TagStatus icone={PauseCircle} cor="negativo">Indisponível</TagStatus>
<TagStatus icone={CheckCircle2} cor="positivo">No rodízio</TagStatus>
<TagStatus>Turma 25A</TagStatus>   // sem ícone: etiqueta informativa
```

| `cor` do ícone | Classe | Quando |
| :--- | :--- | :--- |
| `neutro` (padrão) | `text-slate-400` | Informação sem juízo (folga marcada, recusado, etapa pendente) |
| `positivo` | `text-emerald-600` | Concluído / ativo ("Conta ativada", "No rodízio") |
| `atencao` | `text-amber-600` | Requer acompanhamento ("Em análise", saída prevista) |
| `negativo` | `text-rose-600` | Fora de operação ("Indisponível", "Fora · turma encerrada") |
| `ausente` | `text-sky-600` | Ausência em curso |
| `marca` | `text-psi-vibrant` | Ação ou aviso da plataforma ("Reenviar convite", "Alteração solicitada") |

O estado também precisa aparecer no texto ou na forma do ícone (✓ cheio × círculo vazio), nunca só na cor.

**Não use** a variante *soft-outline* (*outlined tonal badge*): fundo colorido claro, borda da mesma cor e texto mais escuro do mesmo tom (ex.: `bg-emerald-50 border-emerald-200 text-emerald-700`). Ela foi retirada da ficha do psicólogo em 24/11/2026.

O token `coral` (`#F43F5E`, claro `#FECDD3`, escuro `#E11D48`) existe para urgência, mas a página de referência usa `rose-*`. Texto `coral` sobre `coral-light` não atinge contraste suficiente; use o par `rose-50`/`rose-700` ou mais escuro.

---

## 3. Tipografia

- **Fonte:** Inter Tight (fallback Inter, sans-serif), via `font-sans`. É a única fonte das telas da aplicação.
- **Fraunces** (`font-display`) está configurada e aparece só em páginas de conta (ativar conta, redefinir senha) e no Termo de Adesão. Não use em telas operacionais.
- Números em dados e horários usam `tabular-nums`.

| Elemento | Classes | Exemplo |
| :--- | :--- | :--- |
| Título da página (`h1`) | `text-2xl font-black text-ink` com ícone `w-6 h-6 text-psi-vibrant` | "Sua agenda de atendimentos" |
| Descrição da página | `text-xs text-muted`, largura `max-w-3xl` | Texto abaixo do título |
| Título de card (`h2`) | `text-base font-black text-psi-darkest` | "Resumo da sua disponibilidade" |
| Descrição de card | `mt-1 text-xs text-muted` | |
| Rótulo de dado | `text-[11px] font-semibold text-muted` | "Dias de atendimento" |
| Valor de dado | `text-[12.5px] font-extrabold text-ink tabular-nums` | "Segunda a sexta" |
| Título em bloco escuro | `font-black` em branco; descrição `text-xs text-white/70` | "Link de agendamento" |

---

## 4. Superfícies, raios e sombras

| Token | Valor |
| :--- | :--- |
| `rounded-xl` | `1rem`: botões, campos, chips de horário |
| `rounded-2xl` | `1.25rem`: faixas internas e avisos |
| `rounded-3xl` | `1.5rem`: bloco escuro de destaque |
| `rounded-[20px]` | cards brancos de conteúdo |
| `shadow-card` | `0 4px 20px rgba(67,38,94,.04), 0 1px 3px rgba(0,0,0,.02)` |
| `shadow-contrast` | `0 10px 30px rgba(67,38,94,.18)`: só no bloco escuro |
| `shadow-lift` | `0 12px 28px rgba(92,57,125,.12)`: elevação no hover |

Há três tipos de superfície, sem misturar:
1. **Card de conteúdo:** `rounded-[20px] border border-line bg-surface p-4 shadow-card sm:p-6`.
2. **Bloco de destaque escuro:** `bg-psi-darkest text-white p-6 rounded-3xl shadow-contrast`. Um por página, para a informação principal: o link de agendamento.
3. **Faixa interna** dentro de um card: `rounded-2xl bg-[#F7F3FB]`, sem borda nem sombra, com divisórias `#E6DCF0` entre os itens.

Não coloque card dentro de card. Dentro de um card, use a faixa interna.

---

## 5. Componentes

### Cabeçalho da página
```tsx
<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
  <div>
    <span className="chip-accent text-[11px] mb-1">Agenda &amp; Horários</span>
    <h1 className="text-2xl font-black text-ink flex items-center gap-2">
      <CalendarDays className="w-6 h-6 text-psi-vibrant" /> Sua agenda de atendimentos
    </h1>
    <p className="max-w-3xl text-xs text-muted">…</p>
  </div>
  <div className="flex shrink-0 flex-wrap gap-2">
    <button className="btn-outline px-4 py-2.5 text-[13px] font-bold">Ver passo a passo</button>
    <button className="btn-accent px-5 py-3 text-xs">Agendar sessão</button>
  </div>
</div>
```

### Botões (classes em `globals.css`)
| Classe | Aparência | Quando usar |
| :--- | :--- | :--- |
| `btn-accent` | `psi-vibrant`, texto branco | A ação principal da página (uma por tela) |
| `btn-primary` | `psi-deep`, texto branco | Salvar e confirmar dentro de cards e formulários |
| `btn-outline` | branco, borda `psi-soft`, texto `psi-darkest` | Ações secundárias ("Editar disponibilidade", "Ver passo a passo") |
| `btn-ghost` | transparente, texto `muted` | Cancelar, ações terciárias |

No bloco escuro, a ação principal é um botão branco (`bg-white text-psi-darkest font-black`) e a secundária é translúcida (`bg-white/15 hover:bg-white/25`).

### Abas
Barra branca com as abas dentro (`rounded-[18px] border border-line bg-surface p-1.5 shadow-card`):
- **Aba ativa:** `bg-psi-darkest text-white`.
- **Aba inativa:** `text-muted hover:bg-canvas`.
- **Contador:** `bg-psi-vibrant text-white` na aba ativa, `bg-psi-soft text-psi-deep` na inativa.

A barra usa `role="tablist"`, e cada painel, `role="tabpanel"`.

### Faixa de dados com ícones
Usada no "Resumo da sua disponibilidade":
- **Faixa:** `grid … rounded-2xl bg-[#F7F3FB] px-2 py-4`.
- **Itens:** cada um com ícone `h-6 w-6 text-psi-deep`, rótulo `muted` e valor `ink`, separados por `border-l border-[#E6DCF0]`.

### Chips
- `chip-accent`: etiqueta da página (lilás `psi-soft`, texto `psi-darkest`).
- **Chip de valor**, como o horário "08:00": `rounded-lg border border-psi-soft bg-white px-2 py-0.5 font-extrabold text-psi-darkest tabular-nums`.

### Campos
```ts
'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-extrabold text-ink focus:border-psi-vibrant focus:outline-none focus:ring-2 focus:ring-psi-vibrant/20'
```
A classe `.input` de `globals.css` segue a mesma ideia com borda `psi-soft`.

### Dica / ajuda
`flex items-start gap-3 rounded-2xl bg-[#F4EEFA] px-4 py-3.5 text-[12.5px] leading-relaxed text-[#4A3D58]` com ícone `text-psi-vibrant`.

---

## 6. O que não usar

O padrão abaixo aparece na ficha do psicólogo em **Gestão de Psicólogos** ([PsicologoCardDetalhes](../../apps/web/src/components/gestao/PsicologoCardDetalhes.tsx), [SemaforoCredenciamento](../../apps/web/src/components/gestao/SemaforoCredenciamento.tsx)). **Não deve ser copiado**:

- **Chips coloridos por categoria (variante soft-outline)**: verde/menta para "Acesso criado", "Convite enviado", "Conta ativada" e para as demandas; vermelho para "Indisponível"; cinza para "Folga"; lilás para turma e "Reenviar convite". Cada cor diferente compete pela atenção sem indicar prioridade. As tags de status do card e os marcos do credenciamento já usam a tag neutra; as demandas, os públicos e os serviços nos detalhes ainda não.
- **Cards de seção com tons diferentes** lado a lado: branco em "Serviços", lilás em "Público alvo", verde-água em "Demandas". A seção não precisa de cor própria; título e conteúdo bastam.
- **Barra de capacidade vermelha cheia** para indicar "5/5". Lotação é situação normal de trabalho, não erro.
- **Faixa amarela larga e arredondada** como aviso fixo dentro da ficha.
- **Rótulos em CAIXA ALTA cinza-azulado** ("TURNOS", "CAPACIDADE") em `slate`. Use o rótulo `muted` em caixa normal da seção 3.

Em vez disso:
- Use a tag neutra (`TagStatus`) para status e etiquetas, com a cor só no ícone.
- Reserve as cores de estado da seção 2 para o que realmente é erro ou aviso.
- Organize as seções com cards brancos iguais.

---

## 7. Modo de impressão (certificados)

Estilização `@media print` com a classe `.cert-printable` (em `globals.css`). Exibe só o certificado em A4 paisagem e oculta navegação e sidebars (`.no-print`).
