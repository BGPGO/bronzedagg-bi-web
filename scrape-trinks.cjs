/**
 * scrape-trinks.cjs — Playwright scraper para faturamento diário do Trinks
 *
 * Fluxo:
 *   1. Login em trinks.com (BackOffice)
 *   2. Para cada unidade: troca via dropdown de estabelecimento
 *   3. Para cada mês no range: filtra relatório Financeiro-Caixa
 *      por "Data de Atendimento/Venda" e extrai tabela diária
 *   4. Salva JSONs individuais em BASES/TRINKS/
 *   5. Gera faturamento_trinks.xlsx consolidado (todos os anos)
 *
 * Uso:
 *   node scrape-trinks.cjs                          # 01/2025 até mês atual
 *   node scrape-trinks.cjs --ano 2026 --mes 7       # só julho/2026
 *   node scrape-trinks.cjs --headless               # sem janela (servidor)
 *   node scrape-trinks.cjs --daily                  # modo diário (só mês atual)
 *
 * Env vars:
 *   TRINKS_EMAIL, TRINKS_PASS   — credenciais (default: hardcoded)
 *   BASES_DIR                   — caminho alternativo para BASES/
 */
'use strict';

const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const TRINKS_EMAIL = process.env.TRINKS_EMAIL || 'henrique.kovalezyk@bertuzzipatrimonial.com.br';
const TRINKS_PASS  = process.env.TRINKS_PASS  || '4b2efb';

const BASES_DIR  = path.resolve(process.env.BASES_DIR || 'G:/Meu Drive/BGP/CLIENTES/BI/489. BRONZE DA GG/BASES');
const TRINKS_DIR = path.join(BASES_DIR, 'TRINKS');
const XLSX_OUT   = path.join(BASES_DIR, process.env.TRINKS_XLSX || '[Grupo BGG] Faturamento 2026.xlsx');

const REPORT_URL = 'https://www.trinks.com/BackOffice/Relatorios/Financeiro';

const UNIDADES = [
  { trinks: 'BGG Alphaville',  slug: 'BGG_Alphaville',  nome: 'Alphaville' },
  { trinks: 'BGG Itaim',       slug: 'BGG_Itaim',       nome: 'Itaim' },
  { trinks: 'BGG Menino Deus', slug: 'BGG_Menino_Deus', nome: 'Menino Deus' },
  { trinks: 'GG House',        slug: 'GG_House',        nome: 'GG House' },
];

// Range padrão: jan/2025 até mês atual
const ANO_INICIO = 2025;
const MES_INICIO = 1;

// ─── HELPERS ───────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { headless: false, ano: null, mes: null, daily: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--headless') opts.headless = true;
    if (args[i] === '--daily') opts.daily = true;
    if (args[i] === '--ano' && args[i + 1]) opts.ano = parseInt(args[i + 1], 10);
    if (args[i] === '--mes' && args[i + 1]) opts.mes = parseInt(args[i + 1], 10);
  }
  return opts;
}

/**
 * Gera lista de {ano, mes} no range solicitado
 */
function gerarMeses(opts) {
  const now = new Date();
  const anoAtual = now.getFullYear();
  const mesAtual = now.getMonth() + 1;

  // --daily: só mês atual do ano atual
  if (opts.daily) {
    return [{ ano: anoAtual, mes: mesAtual }];
  }

  // --ano X --mes Y: mês específico
  if (opts.ano && opts.mes) {
    return [{ ano: opts.ano, mes: opts.mes }];
  }

  // --ano X: todos os meses daquele ano (até mês atual se for ano atual)
  if (opts.ano) {
    const maxMes = opts.ano === anoAtual ? mesAtual : 12;
    return Array.from({ length: maxMes }, (_, i) => ({ ano: opts.ano, mes: i + 1 }));
  }

  // Default: jan/2025 até mês atual
  const meses = [];
  for (let a = ANO_INICIO; a <= anoAtual; a++) {
    const mInicio = (a === ANO_INICIO) ? MES_INICIO : 1;
    const mFim = (a === anoAtual) ? mesAtual : 12;
    for (let m = mInicio; m <= mFim; m++) {
      meses.push({ ano: a, mes: m });
    }
  }
  return meses;
}

function numBR(v) {
  if (v == null || v === '' || v === '-') return 0;
  const s = String(v).replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function pad2(n) { return String(n).padStart(2, '0'); }
function lastDayOfMonth(year, month) { return new Date(year, month, 0).getDate(); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Delay aleatório entre requests para evitar WAF/captcha
function randomDelay(min = 2000, max = 5000) {
  return sleep(min + Math.random() * (max - min));
}

/**
 * Verifica e tenta resolver captcha WAF do Trinks.
 * Retorna true se captcha foi detectado e resolvido, false se não havia captcha.
 */
async function handleWAF(page) {
  const waf = await page.$('#waf-captcha-overlay.waf-visible, .waf-visible');
  if (!waf) return false;

  console.log('>> WAF captcha detectado! Aguardando resolução...');
  // Em headless não tem como resolver captcha — esperar e tentar reload
  await sleep(15000);
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await sleep(5000);

  const wafAfter = await page.$('#waf-captcha-overlay.waf-visible');
  if (wafAfter) {
    console.log('>> WAF ainda ativo — aguardando mais 30s...');
    await sleep(30000);
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await sleep(5000);
  }

  return true;
}

// ─── LOGIN ─────────────────────────────────────────────────────────────────────

async function login(page) {
  console.log('>> Login no Trinks...');
  await page.goto('https://www.trinks.com/Login', { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);

  // Fechar banner de cookies
  const cookieBtn = await page.$('button:has-text("Aceitar"), a:has-text("Aceitar")');
  if (cookieBtn) {
    await cookieBtn.click();
    await sleep(500);
  }

  const inputs = await page.$$('input:visible');
  if (inputs.length < 2) throw new Error('Campos de login não encontrados');
  await inputs[0].fill(TRINKS_EMAIL);
  await sleep(300);
  await inputs[1].fill(TRINKS_PASS);
  await sleep(300);

  await page.click('button:has-text("Entrar"), a:has-text("Entrar")');
  await page.waitForLoadState('networkidle');
  await sleep(3000);

  if (page.url().includes('/Login')) {
    const estab = await page.$('a:has-text("estabelecimento")');
    if (estab) {
      await estab.click();
      await page.waitForLoadState('networkidle');
      await sleep(2000);
      const inputs2 = await page.$$('input:visible');
      if (inputs2.length >= 2) {
        await inputs2[0].fill(TRINKS_EMAIL);
        await inputs2[1].fill(TRINKS_PASS);
        await page.click('button:has-text("Entrar")');
        await page.waitForLoadState('networkidle');
        await sleep(3000);
      }
    }
  }

  if (page.url().includes('/Login')) {
    throw new Error('Falha no login — verifique credenciais');
  }
  console.log('>> Login OK');
}

// ─── TROCAR UNIDADE ────────────────────────────────────────────────────────────

async function trocarUnidade(page, unidade) {
  const current = await page.$eval(
    '#menuBackoffice .c-header__container-flex-select__customized-select',
    el => el.innerText.trim()
  ).catch(() => '');

  if (current.includes(unidade.trinks) || current.includes(unidade.nome)) {
    return true;
  }

  console.log(`>> Trocando para: ${unidade.trinks}`);
  await page.click('#menuBackoffice [data-cy="dropdown-estabelecimentos"]');
  await sleep(800);

  const items = await page.$$('#menuBackoffice .o-dropdown__menu-item');
  for (const item of items) {
    const text = await item.innerText();
    if (text.trim() === unidade.trinks) {
      await item.click();
      await page.waitForLoadState('networkidle');
      await sleep(3000);
      console.log(`>> Unidade: ${unidade.trinks}`);
      return true;
    }
  }

  console.warn(`>> AVISO: não encontrou ${unidade.trinks} no dropdown`);
  return false;
}

// ─── EXTRAIR DADOS ─────────────────────────────────────────────────────────────

async function extrairMes(page, unidade, ano, mes) {
  const ini = `01/${pad2(mes)}/${ano}`;
  const lastDay = lastDayOfMonth(ano, mes);
  const fim = `${lastDay}/${pad2(mes)}/${ano}`;

  // Filtrar
  await page.selectOption('#TipoData', '1');
  await sleep(300);
  await page.fill('#DataInicio', '');
  await page.fill('#DataInicio', ini);
  await sleep(200);
  await page.fill('#DataFim', '');
  await page.fill('#DataFim', fim);
  await sleep(200);

  await page.click('#filtrar');
  await page.waitForLoadState('networkidle');
  await sleep(3000);

  // Extrair TODAS as linhas da tabela:
  //   - Resumo diário (class padding-td, data dd/mm/yyyy (dia))
  //   - Transações individuais (data dd/mm/yyyy, horário, cliente, valores)
  //
  // Para o formato "Relatório Sistema" precisamos das transações individuais.
  // Formato das transações:
  //   [dataAtend, dataMovim+hora, cliente, servicos, produtos, pacotes, VP, CC,
  //    descontos, crédito, débito, dinheiro, prépago, outros, troco, gorjeta, total, ""]

  const transactions = [];

  const allRows = await page.$$eval('table tr', trs =>
    trs.map(tr => ({
      className: tr.className,
      cells: [...tr.querySelectorAll('td')].map(td => td.innerText.trim())
    }))
  );

  // Extrair transações individuais (linhas com data + hora)
  for (const row of allRows) {
    if (row.cells.length < 10) continue;

    // Transação individual: tem "dd/mm/yyyy (dia)" na 1ª cel e "dd/mm/yyyy HH:MM" na 2ª
    const atendCell = row.cells[0];
    const movimCell = row.cells[1];
    const clienteCell = row.cells[2];

    if (!atendCell || !movimCell) continue;

    const atendMatch = atendCell.match(/^(\d{2}\/\d{2}\/\d{4})/);
    const movimMatch = movimCell.match(/^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/);

    if (!atendMatch || !movimMatch) continue;

    // Pular headers e totais
    if (/^(Total|Atendimento|Resumo|Data|Mês)/i.test(atendCell)) continue;

    const dataAtend = atendMatch[1];
    const dataPgto = movimMatch[1];
    const cliente = clienteCell || '';
    const vals = row.cells.slice(3).map(numBR);

    // vals: [0]=servicos, [1]=produtos, [2]=pacotes, [3]=VP, [4]=CC,
    //       [5]=descontos(texto+valor), [6]=crédito, [7]=débito, [8]=dinheiro,
    //       [9]=prépago, [10]=outros, [11]=troco, [12]=gorjeta, [13]=total

    if (vals.length >= 10) {
      transactions.push({
        data_atendimento: dataAtend,
        data_pagamento: dataPgto,
        cliente: cliente,
        servicos: vals[0] || 0,
        produtos: vals[1] || 0,
        pacotes: vals[2] || 0,
        vale_presente: vals[3] || 0,
        credito_cliente: vals[4] || 0,
        descontos: vals[5] || 0,
        pgto_credito: vals[6] || 0,
        pgto_debito: vals[7] || 0,
        pgto_dinheiro: vals[8] || 0,
        pgto_prepago: vals[9] || 0,
        pgto_outros: vals[10] || 0,
        troco: vals[11] || 0,
        gorjeta: vals[12] || 0,
        total: vals[13] || vals[vals.length - 2] || 0,
      });
    }
  }

  // Se não encontrou transações, tentar extrair resumos diários como fallback
  if (transactions.length === 0) {
    for (const row of allRows) {
      if (row.cells.length < 15) continue;
      const dateCell = row.cells.find(c => /^\d{2}\/\d{2}\/\d{4}\s*\(/.test(c));
      if (!dateCell) continue;
      // Pular se tem horário (é transação, não resumo)
      if (row.cells.some(c => /^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/.test(c))) continue;
      if (row.cells.some(c => /^(Total|Atendimento|Resumo|Data de|Mês)/i.test(c))) continue;

      const dateStr = dateCell.match(/^(\d{2}\/\d{2}\/\d{4})/)[1];
      const idx = row.cells.indexOf(dateCell);
      const after = row.cells.slice(idx + 1).map(numBR);

      if (after.length >= 15) {
        transactions.push({
          data_atendimento: dateStr,
          data_pagamento: dateStr,
          cliente: '',
          servicos: after[3],
          produtos: after[4],
          pacotes: after[5],
          vale_presente: after[6],
          credito_cliente: after[7],
          descontos: after[8],
          pgto_credito: after[9] || 0,
          pgto_debito: after[10] || 0,
          pgto_dinheiro: after[11] || 0,
          pgto_prepago: after[12] || 0,
          pgto_outros: after[13] || 0,
          troco: after[14] || 0,
          gorjeta: after[15] || 0,
          total: after[16] || after[after.length - 2] || 0,
        });
      }
    }
  }

  console.log(`  ${unidade.trinks} ${pad2(mes)}/${ano}: ${transactions.length} transações`);
  return transactions;
}

// ─── SALVAR JSON ───────────────────────────────────────────────────────────────

function salvarJSON(unidade, ano, mes, dailyData) {
  const label = `${ano}-${pad2(mes)}`;
  const json = {
    unidade: unidade.trinks,
    periodo: {
      ini: `01/${pad2(mes)}/${ano}`,
      fim: `${lastDayOfMonth(ano, mes)}/${pad2(mes)}/${ano}`,
      label,
    },
    transacoes: dailyData,
    scrape_timestamp: new Date().toISOString(),
  };

  const outFile = path.join(TRINKS_DIR, `${unidade.slug}_${label}.json`);
  fs.mkdirSync(TRINKS_DIR, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(json, null, 2));
}

// ─── GERAR XLSX CONSOLIDADO ────────────────────────────────────────────────────
// Gera UM único XLSX com todos os anos (2025+2026+...)

/**
 * Gera XLSX no formato "Relatório Sistema" — compatível com o adapter bronzedagg.cjs.
 * Cada linha é uma transação individual com colunas:
 *   Centro de Custo, Data de Atendimento/Venda, Data de Pagamento/Estorno,
 *   Tipo, Nome do Cliente, Total (R$) Serviço, Total (R$) Produtos,
 *   Total (R$) Pacotes, Total (R$) Vale-Presente, Total (R$) Crédito Cliente,
 *   Total (R$) Descontos, Total (R$) Crédito, Total (R$) Débito,
 *   Total (R$) Dinheiro, Total (R$) Pré-Pago, Total (R$) Outros,
 *   Total (R$) Troco, Total (R$) Gorjeta, Total (R$)
 */
function gerarXLSX(allData) {
  const rows = [];

  for (const { unidade, dados } of allData) {
    // Determinar nome da unidade para "Centro de Custo"
    // O adapter espera nomes como "Alphaville", "Itaim", "GG House", "Menino Deus"
    const centroCusto = unidade.nome;

    for (const d of dados) {
      rows.push({
        'Centro de Custo': centroCusto,
        'Data de Atendimento/Venda': d.data_atendimento || d.data || '',
        'Data de Pagamento/Estorno': d.data_pagamento || d.data || '',
        'Tipo': 'Pagamento',
        'Nome do Cliente': d.cliente || '',
        'Total (R$) Serviço': d.servicos || 0,
        'Total (R$) Produtos': d.produtos || 0,
        'Total (R$) Pacotes': d.pacotes || 0,
        'Total (R$) Vale-Presente': d.vale_presente || 0,
        'Total (R$) Crédito Cliente': d.credito_cliente || 0,
        'Total (R$) Descontos': d.descontos || 0,
        'Total (R$) Crédito': d.pgto_credito || 0,
        'Total (R$) Débito': d.pgto_debito || 0,
        'Total (R$) Dinheiro': d.pgto_dinheiro || 0,
        'Total (R$) Pré-Pago': d.pgto_prepago || 0,
        'Total (R$) Outros': d.pgto_outros || 0,
        'Total (R$) Troco': d.troco || 0,
        'Total (R$) Gorjeta': d.gorjeta || 0,
        'Total (R$)': d.total || 0,
      });
    }
  }

  rows.sort((a, b) => {
    const da = a['Data de Atendimento/Venda'], db = b['Data de Atendimento/Venda'];
    if (!da || !db) return 0;
    const [dd1, mm1, yy1] = da.split('/');
    const [dd2, mm2, yy2] = db.split('/');
    return new Date(`${yy1}-${mm1}-${dd1}`) - new Date(`${yy2}-${mm2}-${dd2}`);
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório Sistema');
  XLSX.writeFile(wb, XLSX_OUT);
  console.log(`\n>> XLSX: ${XLSX_OUT} (${rows.length} transações)`);
}

// ─── CARREGAR JSONs ────────────────────────────────────────────────────────────

function carregarTodosJSONs() {
  const allData = [];
  for (const unidade of UNIDADES) {
    const dados = [];
    // Varrer todos os JSONs que existem para esta unidade
    const pattern = new RegExp(`^${unidade.slug}_(\\d{4})-(\\d{2})\\.json$`);
    if (!fs.existsSync(TRINKS_DIR)) continue;
    const files = fs.readdirSync(TRINKS_DIR).filter(f => pattern.test(f)).sort();
    for (const file of files) {
      try {
        const json = JSON.parse(fs.readFileSync(path.join(TRINKS_DIR, file), 'utf-8'));
        if (json.transacoes) {
          dados.push(...json.transacoes);
        } else if (json.dados_diarios) {
          dados.push(...json.dados_diarios);
        } else if (json.resumo_tabelas) {
          dados.push(...parseOldJSON(json));
        }
      } catch (e) {
        console.warn(`>> AVISO: erro lendo ${file}: ${e.message}`);
      }
    }
    if (dados.length > 0) allData.push({ unidade, dados });
  }
  return allData;
}

function parseOldJSON(json) {
  const dados = [];
  if (!json.resumo_tabelas?.[0]) return dados;
  const block = json.resumo_tabelas[0];
  for (const item of block) {
    if (!Array.isArray(item)) continue;
    const dateCell = item[1];
    if (typeof dateCell !== 'string') continue;
    const dm = dateCell.match(/^(\d{2}\/\d{2}\/\d{4})/);
    if (!dm) continue;
    dados.push({
      data: dm[1],
      servicos: numBR(item[5]),
      produtos: numBR(item[6]),
      pacotes: numBR(item[7]),
      vale_presente: numBR(item[8]),
      credito_cliente: numBR(item[9]),
      descontos: numBR(item[10]),
      total_recebido: numBR(item[18]),
    });
  }
  return dados;
}

// ─── MERGE ─────────────────────────────────────────────────────────────────────

function mergeData(scraped, existing) {
  const merged = new Map();
  for (const item of scraped) merged.set(item.unidade.slug, item);
  for (const item of existing) {
    if (!merged.has(item.unidade.slug)) {
      merged.set(item.unidade.slug, item);
    } else {
      const current = merged.get(item.unidade.slug);
      const existingDates = new Set(current.dados.map(d => d.data));
      for (const d of item.dados) {
        if (!existingDates.has(d.data)) current.dados.push(d);
      }
    }
  }
  return Array.from(merged.values());
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  const meses = gerarMeses(opts);

  const anosUnicos = [...new Set(meses.map(m => m.ano))].sort();
  console.log(`\n=== SCRAPE TRINKS ===`);
  console.log(`Range: ${pad2(meses[0].mes)}/${meses[0].ano} → ${pad2(meses[meses.length - 1].mes)}/${meses[meses.length - 1].ano}`);
  console.log(`Total meses: ${meses.length} | Anos: ${anosUnicos.join(', ')}`);
  console.log(`Unidades: ${UNIDADES.map(u => u.trinks).join(', ')}`);
  console.log(`Headless: ${opts.headless}\n`);

  const browser = await chromium.launch({
    headless: opts.headless,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: 'pt-BR',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);

  try {
    await login(page);

    const scrapedData = [];

    for (const unidade of UNIDADES) {
      console.log(`\n── ${unidade.trinks} ──`);
      const unidadeDados = [];

      // Navegar ao relatório e trocar unidade
      await handleWAF(page);
      await page.goto(REPORT_URL, { waitUntil: 'networkidle', timeout: 60000 });
      await sleep(2000);
      await handleWAF(page);
      await trocarUnidade(page, unidade);
      await page.goto(REPORT_URL, { waitUntil: 'networkidle', timeout: 60000 });
      await randomDelay(3000, 5000);

      for (const { ano, mes } of meses) {
        try {
          // Checar WAF antes de cada request
          await handleWAF(page);

          const dailyData = await extrairMes(page, unidade, ano, mes);

          if (dailyData.length > 0) {
            salvarJSON(unidade, ano, mes, dailyData);
            unidadeDados.push(...dailyData);
          } else {
            console.warn(`  AVISO: 0 dias para ${pad2(mes)}/${ano}`);
          }

          // Delay entre meses para evitar WAF
          await randomDelay(3000, 6000);
        } catch (err) {
          console.error(`  ERRO ${pad2(mes)}/${ano}: ${err.message.split('\n')[0]}`);
          // Checar se é WAF
          const wasWAF = await handleWAF(page);
          if (wasWAF) {
            // Tentar de novo este mês após resolver WAF
            try {
              await page.goto(REPORT_URL, { waitUntil: 'networkidle', timeout: 60000 });
              await sleep(3000);
              const retry = await extrairMes(page, unidade, ano, mes);
              if (retry.length > 0) {
                salvarJSON(unidade, ano, mes, retry);
                unidadeDados.push(...retry);
                console.log(`  RETRY OK: ${pad2(mes)}/${ano}: ${retry.length} dias`);
              }
            } catch (e2) {
              console.error(`  RETRY FALHOU ${pad2(mes)}/${ano}`);
            }
          }
          // Voltar ao relatório para continuar
          await page.goto(REPORT_URL, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
          await sleep(3000);
        }
      }

      if (unidadeDados.length > 0) {
        scrapedData.push({ unidade, dados: unidadeDados });
      }
    }

    // Complementar com JSONs existentes (meses que não foram re-scraped)
    const existingData = carregarTodosJSONs();
    const mergedData = mergeData(scrapedData, existingData);

    gerarXLSX(mergedData);

    const totalDias = mergedData.reduce((s, d) => s + d.dados.length, 0);
    console.log(`\n=== CONCLUÍDO: ${mergedData.length} unidades, ${totalDias} dias ===`);

  } catch (err) {
    console.error('\n>> ERRO FATAL:', err.message);
    const ssPath = path.join(TRINKS_DIR, `debug_${Date.now()}.png`);
    await page.screenshot({ path: ssPath, fullPage: true }).catch(() => {});

    // Fallback: XLSX dos JSONs existentes
    console.log('>> Fallback: gerando XLSX dos JSONs existentes...');
    const fallbackData = carregarTodosJSONs();
    if (fallbackData.length > 0) gerarXLSX(fallbackData);
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
