# GUIA — Criar BI novo (ecossistema BGP BI)

> Guia de referência para criar um BI novo **rápido e sem se perder**, mesmo com
> fontes de dados muito diferentes e telas personalizadas. É o "mapa" que a skill
> `CriarBI` usa para classificar o projeto e escolher o caminho certo.
>
> **Antes de codar**, leia os docs canônicos: `bi-blueprint/BLUEPRINT.md`,
> `ANTI_PATTERNS.md` (20 bugs reais), `CHECKLIST.md` (pre-flight). Este guia
> NÃO os substitui — ele decide **qual caminho** seguir e **o que perguntar**.

---

## Por que este guia existe

O que faz a gente se perder em BI personalizado **não é o template** — é a
combinação de (1) fonte de dados, (2) telas extras e (3) regras de negócio do
cliente, cada uma puxando para um lado. A solução é **front-load**: classificar o
projeto em 6 eixos e coletar TODO o contexto ANTES de criar o repo. Cinco minutos
de perguntas certas economizam horas de retrabalho.

---

## 1. Os 6 eixos de classificação

Todo BI se descreve por estes 6 eixos. Definir os 6 = saber exatamente o que construir.

| # | Eixo | Opções | Decide… |
|---|------|--------|---------|
| 1 | **Origem do projeto** | template novo / clone de cliente parecido / pipeline Python custom | a topologia de arquivos e os comandos |
| 2 | **Fonte de dados** | Omie · Conta Azul · XLSX manual · ERP/API custom (TOTVS, Sponte, Centris, API própria) | o ETL e os adapters (eixo crítico — ver §2) |
| 3 | **Empresas** | single-empresa / multi-empresa consolidado / multi-empresa com filtro | merge de movimentos + seletor de empresa |
| 4 | **Telas** | core financeiro (sempre) + extras + upsell PRO | `bi.config.js > pages` e quais `pages-*.jsx` mexer |
| 5 | **Tema/branding** | dark cyan-tech (padrão) / claro-branco / cor primária custom + logo | `styles.css` (:root) e `assets/` |
| 6 | **Deploy & refresh** | Coolify (sempre) + estratégia de cron (interno no container / Task Scheduler / GitHub Actions) | Dockerfile, entrypoint, crontab |

Regra de ouro: **se você não consegue preencher um eixo, pergunte — não invente.**

---

## 2. Eixo crítico — árvore de decisão da FONTE DE DADOS

Esta é a decisão que mais "perde" a gente. Decida a fonte PRIMEIRO; ela dita a
topologia inteira.

```
A fonte tem adapter pronto? (adapters/_CONTRACT.md)
│
├─ SIM → Omie  ............ adapter "omie"        → BI novo do template (bgp-bi init)
│        Conta Azul (API) . adapter "conta-azul"  → idem
│        Conta Azul (XLSX)  adapter xlsx-conta-azul → exclui Transferência=Sim
│        XLSX genérico ..... adapter "manual-xlsx" → lê do Drive
│
└─ NÃO → ERP/banco/API sem adapter (TOTVS/WinThor, Sponte, Centris, API própria)
         → 2 caminhos:
           (a) escrever adapter novo (adapters/<nome>.cjs seguindo _CONTRACT.md)
               se a fonte for reaproveitável em outros clientes
           (b) pipeline Python custom (NÃO usa bgp-bi.cjs) quando a extração é
               muito específica (SQL TOTVS, .xlsb, scraping). Gera os JSON/JS que
               o frontend consome. Ver arquétipo "Pipeline custom" na §8.
```

**Saída canônica (sempre a mesma, independente da fonte):** todo adapter/pipeline
normaliza para `data/movimentos.json` no schema canonical do `_CONTRACT.md`
(`natureza R|P`, valores **sempre positivos**, datas ISO 8601, categorias e cliente
**resolvidos** em texto). O frontend é **agnóstico de fonte** — só consome o canonical.

**Multi-empresa:** rode o pull por empresa, faça merge de `movimentos.json`
dedup por `(fonte, id)`. Para filtro por empresa na UI, carregue o campo de empresa
no eixo de TX (ex.: `ALL_TX[10] = empresa`) e adicione `EmpresaSelect` no header.

**Armadilhas de fonte (de ANTI_PATTERNS.md — leia lá):**
- A5 — **nunca** confie em classificação ABC pré-computada no XLSX. Recompute (80/15/5).
- A6 — faturamento ERP duplica (PEDIDO+Remessa+Devolução). Filtre `Operação=PEDIDO AND Situação=Autorizado`.
- A9 — dado raw multi-ano: filtre o ano no ETL ou imediatamente em useMemo.
- A17 — antes de prometer filtro de mês, confirme que a fonte tem coluna de data.
- A18/A19 — valide regra de negócio com o cliente (início do pipeline; sinal de líquido = receita − despesa).

---

## 3. Catálogo de telas (eixo 4)

`bi.config.js > pages` define o que aparece e o que tem dado. Cada page tem um
**mode**: `"active"` (dado real) · `"upsell"` (badge PRO, sem dado, CTA) · `"hidden"`.

**Core financeiro (`geral`) — quase sempre `active`:**
`overview` · `receita` · `despesa` · `fluxo` · `tesouraria` · `comparativo`

**Upsell PRO (começam `upsell`, viram `active` quando contratam):**
`relatorio_ia` (Anthropic, temperature 0.2) · `valuation` (DCF, premissas em `meta`)

**Extras (`outros`) — ativar só quando tem a base:**
| Page | Fonte típica | Regra-chave |
|------|--------------|-------------|
| `faturamento_produto` | XLSX FaturamentoPorProduto | dedup PEDIDO+Autorizado (A6) |
| `curva_abc` | XLSX produtos | recomputar ABC 80/15/5 (A5) |
| `cmv_pedidos` | Omie pedidos de venda | CMV% = despesa 5.1.1 ÷ vendas (ex.: Limpuz) |
| `estoque` | ERP estoque | — |
| `metas` / `orcamento` | planilha de metas | comparar realizado × meta/orçado |
| `crm_omie` | Omie CRM consolidado | confirmar fase inicial do pipeline (A18) |
| `marketing_ads` | XLSX ADS | precisa range de datas (A17) |
| `headcount` / `turnover` | RH | — |

**Regra-mãe (BLUEPRINT §6):** filtro que aparece na UI **tem que filtrar de
verdade** — se for decorativo, REMOVE. E **toda page é reativa a
(year, month, statusFilter, drilldown)** via `useMemo(getBit(...))`.

---

## 4. Contexto do cliente — o que coletar SEMPRE

Antes de criar o repo, tenha em mãos:

- [ ] **Nome do cliente** + **slug** do repo (`<slug>-bi-web`)
- [ ] **Número da pasta** no Drive: `G:\Meu Drive\BGP\CLIENTES\BI\<NÚMERO>. <NOME>\BASES`
- [ ] **Credenciais da fonte** (Omie app_key/secret; Conta Azul tokens; ou login do ERP/banco)
- [ ] **Single ou multi-empresa** (se multi: quais empresas/CNPJs, consolidado ou com filtro)
- [ ] **Códigos de banco** relevantes (`bancos_ok`, ex.: 033/748/756) — confirmar com cliente
- [ ] **Regras de negócio específicas** (o que conta como venda, início do pipeline, exclusões)
- [ ] **Fonte oficial para validar** (PBI, Excel, ERP) — os números do BI têm que bater (±5%)
- [ ] **Prints do PowerBI antigo?** → servem para entender **O QUE** o cliente precisa, **NÃO COMO** desenhar. O visual segue sempre o tema padrão BGP.

---

## 5. O prompt ótimo (preenchível)

Versão evoluída do `bi-template/PROMPT_TEMPLATE.md`, já com os 6 eixos. Cole no
Claude Code (modo autônomo lê `bi-template/CLAUDE.md` antes):

```
Modo autônomo BGP BI. Lê primeiro C:\Projects\bi-template\CLAUDE.md.

CRIAR BI NOVO — classificação (6 eixos):
1. Origem ......... [template novo | clone de <cliente> parecido | pipeline Python custom]
2. Fonte .......... [omie | conta-azul | conta-azul-xlsx | manual-xlsx | custom: <qual>]
3. Empresas ....... [single | multi consolidado | multi com filtro] → <quais/CNPJs>
4. Telas .......... core (overview,receita,despesa,fluxo,tesouraria,comparativo)
                    + extras: <faturamento_produto, curva_abc, cmv_pedidos, ...>
                    + upsell PRO: <relatorio_ia, valuation>
5. Tema ........... [dark cyan-tech padrão | claro-branco | custom <hex> + logo]
6. Deploy ......... Coolify (projeto BGP BI, GitHub App BGPGO) + cron <interno | task scheduler | actions>

CONTEXTO DO CLIENTE:
- Nome / slug: <NOME> / <slug>-bi-web
- Drive: G:\Meu Drive\BGP\CLIENTES\BI\<NÚMERO>. <NOME>\BASES
- Credenciais: <onde estão / .env>
- Regras de negócio: <o que conta como venda, exclusões, início do pipeline>
- Validação: números batem com <PBI/Excel/ERP> (±5%)

EXECUTE: confirma pré-requisitos (node/gh/git), resume em 3 linhas o que entendeu,
e segue o workflow do arquétipo certo (§6-8 do GUIA). Pergunta só em escopo,
credencial faltando ou ambiguidade real de dados. NÃO pede permissão pra
gh/git/npm/node/build/deploy.
```

---

## 6. Workflow — arquétipo "template novo" (fonte com adapter)

Para Omie / Conta Azul / XLSX. **Tempo alvo: 5-10 min até o deploy.**

```bash
gh repo create BGPGO/<slug>-bi-web --template BGPGO/bi-template --private
cd C:/Projects && gh repo clone BGPGO/<slug>-bi-web && cd <slug>-bi-web
npm install --no-audit --no-fund
node bgp-bi.cjs init --cliente "<NOME>" --erp <fonte> --extras <a,b,c>
# edita bi.config.js (pages, drive.base_path, bancos_ok, meta) + .env (creds)
node fetch-data.cjs          # pull da fonte
node bgp-bi.cjs build        # build + smoke test obrigatório
node bgp-bi.cjs publish      # commit + push + Coolify deploy + polling
```
Depois: branding (§ tema), pre-flight `CHECKLIST.md`, validar números × fonte oficial.

## 7. Workflow — arquétipo "clone de cliente parecido"

Quando um cliente existente já tem a mesma fonte+telas (ex.: fbpneus → limpuz/fvl/valoriza).
Mais rápido que template puro quando a personalização já foi resolvida em outro repo.

```bash
cp -r C:/Projects/<base>-bi-web C:/Projects/<slug>-bi-web   # ou clone do repo base
cd C:/Projects/<slug>-bi-web
rm -rf .git && git init && gh repo create BGPGO/<slug>-bi-web --private --source=. --remote=origin
# troca: bi.config.js (cliente, subdomain, drive), .env, assets/ (logo), styles.css (tema se mudar)
# revisa pages-*.jsx removendo telas que o novo cliente NÃO tem
node bgp-bi.cjs build && node bgp-bi.cjs publish
```
⚠️ Cuidados conhecidos: alguns repos têm o `App()` inline em `build-jsx.cjs`
(não em `app.jsx`) — ex.: Barleys. Confira antes de procurar o componente raiz.

## 8. Workflow — arquétipo "pipeline Python custom"

Quando a fonte não tem adapter e é específica demais (TOTVS/WinThor SQL, `.xlsb`
via pyxlsb, views Centris, API própria). **Não usa `bgp-bi.cjs`** — o pipeline
Python gera os arquivos de dados que o frontend React consome.

```
ETL Python (extrai da fonte) → data/*.json | data.js (schema canonical) → build-jsx → deploy
```
- Mantém o **mesmo frontend/tema** do template; só o ETL é custom.
- Refresh costuma ser **cron interno no container** (nginx + python + cron),
  atualizando os JSON a cada N min — porque GitHub Actions pode estar bloqueado
  por billing e Task Scheduler exige máquina ligada.
- ⚠️ Nesses repos **não existe `bgp-bi.cjs`** nem npm scripts de build padrão —
  use os scripts do próprio pipeline. Confirme antes de rodar `node bgp-bi.cjs`.

---

## 9. Arquétipos reais (referência rápida — copie do mais parecido)

| Cliente | Origem | Fonte | Empresas | Telas notáveis | Refresh |
|---------|--------|-------|----------|----------------|---------|
| fbpneus | template | Omie | single | core + CMV | cron interno (container) |
| limpuz | clone fbpneus | Omie | single | CMV/Pedidos (5.1.1÷vendas) | Coolify |
| fvl | clone demo | Omie | single | core (tema **claro/branco**) | Coolify |
| valoriza | clone fbpneus | Omie | **2 (filtro)** | só 6 financeiras, EmpresaSelect | Coolify |
| kuba | template | Omie | **2 (consolidado ES+RJ)** | + Estoque/CMV | Coolify |
| barleys | React/esbuild | Omie | **4** | core (App inline no build-jsx!) | Task Scheduler 00:00 |
| M Werneck (6 BIs) | template | **Conta Azul XLSX** | single | adapter xlsx (exclui Transferência=Sim) | Coolify |
| SOD | XLSX-only | **sem ERP** | multi-período | 9 slides CEO executivo | Coolify |
| rumintech | **Python custom** | **TOTVS/WinThor** | single | bi_caixa (sem bgp-bi.cjs!) | pipeline |
| bi-metas | **Python custom** | **.xlsb (pyxlsb)** | **5 grupos** | 7 telas + Orçamento | relatório vai pro Drive |
| FSA | **Python custom** | **Centris (views)** | single | metodologia financeira revisada | pipeline |
| FSRS | API custom | **API própria** | — | chaveamentos squash | cron interno 5min |
| Alexandria (6 BIs) | template | contábil | single | capa match_field=descricao | Coolify |

Provisionamento Coolify (projeto **BGP BI**, GitHub App **BGPGO**): ver memory
`reference_coolify_bgpbi.md`.

---

## 10. Fechamento — pre-flight obrigatório

Antes de mostrar pro cliente, rode **TODO** o `bi-blueprint/CHECKLIST.md` (12 grupos):
build+parse · smoke test Node · filtros filtram de verdade · reatividade ao header ·
UI/UX · mobile 375px · print/PDF com tema preservado · **dados batem com fonte
oficial (±5%)** · relatórios IA · deploy · anti-cache · doc mínima.

> Débito técnico em BI cresce rápido. Nada de "depois ajeito".
```
