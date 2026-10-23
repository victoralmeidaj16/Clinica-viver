# Design System & Identidade Visual — Plataforma Viver +

Este documento define o guia de estilo, sistema de design, tokens de cores, tipografia e padrões de componentes da **Plataforma Viver +** (Viver Mais Psicologia).

---

## 🎨 1. Paleta de Cores e Tokens Visuais

A paleta de cores reflete a marca **Viver Mais Psicologia** (*Brandbook official*), focada em acolhimento, profissionalismo e tecnologia humana.

### Cores Principais

| Token | Hex | Aplicação / Função |
| :--- | :--- | :--- |
| **Primary (DEFAULT)** | `#5C397D` | **Deep Iris**: Cor primária da marca, botões de ação principal, headers e destaque |
| **Primary Dark** | `#46285F` | Estado hover de botões primários e elementos ativos |
| **Primary Light** | `#7E5BA6` | Gradientes e badges secundárias |
| **Accent (Orange)** | `#F99E29` | **Carrot Orange**: Destaques de ação, notificações, botões secundários |
| **Accent Soft** | `#FDE7C7` | Background de alertas e chips de aviso |
| **Capri (Blue)** | `#00C1FF` | **Capri Blue**: Indicadores de progresso, status ativo e tags tecnológicas |
| **Capri Soft** | `#D6F4FF` | Fundo de badges ativas e highlights de progresso |
| **Coral** | `#E0484E` | Alertas de erro, cancelamentos e urgência |

### Neutros e Superfícies

| Token | Hex | Aplicação / Função |
| :--- | :--- | :--- |
| **Ink** | `#241B30` | Cor principal de texto e títulos (`text-ink`) |
| **Muted** | `#6B6275` | Textos secundários, legendas e descrições (`text-muted`) |
| **Surface** | `#FFFFFF` | Fundo de cards, modais e containers |
| **Canvas** | `#f3f3f3cc` | Fundo geral da aplicação (`bg-canvas`) |
| **Soft** | `#EFEAF3` | Fundo de hover, chips neutros e áreas destacadas |
| **Line** | `#E4DEEC` | Bordas e divisores de seção (`border-line`) |

---

## ✍️ 2. Tipografia

- **Fonte Principal (Heading & Body)**: Inter / Sans-serif (`var(--font-sans)`)
- **Hierarquia de Títulos**:
  - `h1` / `.section-title`: 32px a 40px, Extrabold, Leading Tight
  - `h2`: 24px a 28px, Bold
  - `h3`: 18px a 20px, Semibold
  - `.section-lead`: 18px, Regular/Medium (`text-muted`)
  - **Body**: 14px a 16px, Regular (`text-ink`)

---

## 🪟 3. Elevação, Sombras e Arredondamento

### Border Radius
- `xl`: `1.1rem` (~17.6px) — Usado em inputs e botões
- `2xl`: `1.4rem` (~22.4px) — Usado em Cards e containers principais

### Box Shadows
- **Card (`shadow-card`)**: `0 1px 2px rgba(30,42,42,0.04), 0 8px 24px rgba(30,42,42,0.06)`
- **Hover Lift (`shadow-lift`)**: `0 8px 30px rgba(14,110,107,0.14)`

---

## 🧱 4. Componentes Base (Tailwind Utility Classes)

### Botões (`.btn`)
```tsx
// Primário (Ação Principal)
<button className="btn-primary">Acessar Curso</button>

// Contorno / Secundário
<button className="btn-outline">Ver Detalhes</button>

// Transparente / Ghost
<button className="btn-ghost">Cancelar</button>
```

### Cards (`.card`)
```tsx
<div className="card p-6">
  <h3 className="text-lg font-bold text-ink">Título do Módulo</h3>
  <p className="text-sm text-muted mt-2">Descrição do conteúdo do curso.</p>
</div>
```

### Inputs (`.input`)
```tsx
<input className="input" placeholder="Digite seu e-mail..." />
```

### Chips e Badges (`.chip`)
```tsx
<span className="chip">Concluído</span>
```

---

## 🎬 5. Mídia e Video Player

- **Player Vimeo Responsivo (16:9)**: Envolvido pelo container `.video-frame` com `border-radius: 1.1rem` e `background: #0a0a0a`.

---

## 🖨️ 6. Modo de Impressão (Certificados)

- Estilização especial `@media print` com a classe `.cert-printable` para exibir apenas o certificado oficial com layout otimizado A4 paisagem, ocultando navegação e sidebars (`.no-print`).
