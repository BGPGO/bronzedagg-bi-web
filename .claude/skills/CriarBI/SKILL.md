---
name: CriarBI
description: Cria um BI novo no ecossistema BGP BI (template/clone/pipeline custom). Faz as perguntas-chave de classificação — fonte de dados, empresas, telas, tema e contexto do cliente — ANTES de executar, e segue o arquétipo certo até o deploy no Coolify. Use quando o usuário pedir para criar/iniciar/montar um BI novo para um cliente, ou digitar /CriarBI.
---

# CriarBI — criar um BI novo sem se perder

Esta skill resolve o problema de BIs muito personalizados (muitas fontes, muitas
telas) que fazem a gente se perder: ela **front-load a classificação** em 6 eixos,
coleta todo o contexto ANTES de criar o repo, e só então executa o arquétipo certo.

O mapa completo está em **`GUIA_CRIAR_BI.md`** (na pasta desta skill). Leia-o se
precisar dos detalhes de qualquer eixo. Os docs canônicos de arquitetura são
`bi-blueprint/BLUEPRINT.md`, `ANTI_PATTERNS.md` e `CHECKLIST.md` — não os duplique.

## Quando NÃO usar
- Ajustar/corrigir um BI que **já existe** → trabalhe direto no repo do cliente.
- Apenas tirar dúvida de arquitetura → responda com base no BLUEPRINT, sem criar nada.

---

## Passo 1 — Pré-requisitos (verifica em silêncio, avisa só se faltar)
`node --version` (≥18) · `gh auth status` (org BGPGO) · `git --version`.
Se faltar, avise o usuário e pare.

## Passo 2 — Fazer as perguntas-chave (use AskUserQuestion, em UM batch)

Pergunte os 4 eixos de escolha de uma vez (multiSelect onde indicado). Se o usuário
já deu alguma resposta no pedido inicial, **não repergunte** — só confirme o que falta.

1. **Origem** (header "Origem", single): `BI novo do template` (recomendado p/ Omie/Conta Azul) ·
   `Clone de cliente parecido` (quando já existe um repo com a mesma fonte+telas) ·
   `Pipeline Python custom` (fonte sem adapter: TOTVS, .xlsb, Centris, API própria).
2. **Fonte de dados** (header "Fonte", multiSelect): `Omie` · `Conta Azul (API)` ·
   `Conta Azul (XLSX)` · `XLSX manual no Drive` · `ERP/API custom`.
3. **Telas** (header "Telas", multiSelect): `Core financeiro` (sempre) ·
   `Relatório IA (PRO)` · `Valuation (PRO)` · `Faturamento/Curva ABC` ·
   `CMV/Pedidos` · `Estoque` · `Metas/Orçamento` · `CRM` · `Marketing/ADS` ·
   `RH (headcount/turnover)` · `Personalizada`.
4. **Tema** (header "Tema", single): `Dark cyan-tech (padrão BGP)` (recomendado) ·
   `Claro/branco` · `Cor primária custom + logo`.

## Passo 3 — Coletar o contexto do cliente (em prosa, não AskUserQuestion)

Pergunte de uma vez o que ainda não souber (ver checklist §4 do GUIA):
- Nome do cliente + slug do repo (`<slug>-bi-web`)
- Número da pasta no Drive (`G:\Meu Drive\BGP\CLIENTES\BI\<NÚMERO>. <NOME>\BASES`)
- Credenciais da fonte (onde estão / `.env`)
- **Single ou multi-empresa** — se multi: quais/CNPJs, **consolidado** ou **com filtro**
- Códigos de banco relevantes (`bancos_ok`) — confirmar com cliente
- Regras de negócio específicas (o que conta como venda, exclusões, início do pipeline)
- Fonte oficial para validar os números (PBI/Excel/ERP)
- Há prints de PowerBI antigo? → entendem **O QUE**, não **COMO**; visual segue o tema BGP.

## Passo 4 — Classificar e confirmar (3 linhas)

Resuma em ≤3 linhas: arquétipo escolhido + fonte + empresas + telas + tema.
Peça confirmação só se houver ambiguidade real; senão siga.

## Passo 5 — Executar o arquétipo (workflows no GUIA §6-8)

- **Template novo** (Omie/Conta Azul/XLSX): `gh repo create --template BGPGO/bi-template` →
  clone → `npm install` → `bgp-bi.cjs init` → editar `bi.config.js`+`.env` →
  `fetch-data.cjs` → `bgp-bi.cjs build` → `bgp-bi.cjs publish`. Alvo: 5-10 min.
- **Clone de cliente parecido**: `cp -r` do repo base → reset git → trocar
  `bi.config.js`/`.env`/`assets`/tema → **remover telas que o novo cliente não tem** →
  build → publish. ⚠️ Em alguns repos o `App()` está inline em `build-jsx.cjs`.
- **Pipeline Python custom**: **NÃO usa `bgp-bi.cjs`**. O ETL Python gera os
  `data/*.json`/`data.js` (schema canonical do `_CONTRACT.md`); frontend e tema
  seguem o template; refresh via **cron interno no container**. Use os scripts do
  próprio pipeline, não os npm/bgp-bi.

Para multi-empresa: pull por empresa → merge `movimentos.json` dedup `(fonte,id)`;
se for com filtro, carregar empresa no eixo de TX (`ALL_TX[10]`) + `EmpresaSelect` no header.

## Passo 6 — Regras não-negociáveis (de ANTI_PATTERNS.md — aplicar sempre)
1. Hooks no topo, antes de qualquer early return (A2).
2. Filtro que aparece na UI **tem que filtrar** — decorativo = REMOVE.
3. Cards reativos a `(year, month, statusFilter, drilldown)` via `useMemo(getBit())` (A7).
4. **Nunca** confie em classificação pré-computada no XLSX (ABC, status) — recompute (A5).
5. Faturamento ERP: dedup `Operação=PEDIDO AND Situação=Autorizado` (A6).
6. Valores sempre positivos; líquido = receita − despesa (A19).
7. Smoke test em Node antes de push; pre-flight `CHECKLIST.md` antes do cliente.
8. Dados do BI batem com a fonte oficial (±5%) — se não bate, investiga, não "ajusta pra bater".

## Passo 7 — Fechar
Rodar todo o `CHECKLIST.md`, validar números × fonte oficial, confirmar deploy no
browser (não só `curl`), e entregar a URL. Para clientes com refresh agendado,
confirmar que o cron está ativo.

---

**Modo autônomo (de `bi-template/CLAUDE.md`):** executa gh/git/npm/node/build/deploy
sem pedir permissão. Pergunta SÓ em decisão de escopo, credencial faltando ou
ambiguidade real de dados.
