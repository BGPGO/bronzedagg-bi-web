/**
 * scrape-trinks.cjs — Playwright scraper para faturamento diário do Trinks
 *
 * Fluxo:
 *   1. Login em trinks.com (BackOffice)
 *   2. Navega ao "Financeiro – Caixa" (/BackOffice/Relatorios/Financeiro)
 *   3. Para cada unidade + mês: seleciona unidade no dropdown do topo,
 *      define período, filtra por "Data de Atendimento/Venda" e extrai tabela
 *   4. Salva JSONs individuais em BASES/TRINKS/
 *   5. Gera faturamento_trinks_YYYY.xlsx no formato esperado pelo adapter
 *
 * Uso:
 *   node scrape-trinks.cjs                 # scrape todos os meses do ano
 *   node scrape-trinks.cjs --mes 7         # scrape só julho
 *   node scrape-trinks.cjs --headless      # sem janela (CI/CD)
 *
 * Requer: npm i playwright xlsx
 */
'use strict';

const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const TRINKS_EMAIL = process.env.TRINKS_EMAIL || 'henrique.kovalezyk@bertuzzipatrimonial.com.br';
const TRINKS_PASS  = process.env.TRINKS_PASS  || '4b2efb';

const ANO = parseInt(process.env.TRINKS_ANO || new Date().getFullYear(), 10);

const BASES_DIR = path.resolve('G:/Meu Drive/BGP/CLIENTES/BI/489. BRONZE DA GG/BASES');
const TRINKS_DIR = path.join(BASES_DIR, 'TRINKS');
const XLSX_OUT   = path.join(BASES_DIR, `faturamento_trinks_${ANO}.xlsx`);

const REPORT_URL = 'https://www.trinks.com/BackOffice/Relatorios/Financeiro';

// Unidades Trinks — nome como aparece no dropdown do topo do BackOffice
const UNIDADES = [
  { trinks: 'BGG Alphaville',  slug: 'BGG_Alphaville',  nome: 'Alphaville' },
  { trinks: 'BGG Itaim',       slug: 'BGG_Itaim',       nome: 'Itaim' },
  { trinks: 'BGG Menino Deus', slug: 'BGG_Menino_Deus', nome: 'Menino Deus' },
  { trinks: 'GG House',        slug: 'GG_House',        nome: 'GG House' },
];

// ─── HELPERS ───────────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { headless: false, mes: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--headless') opts.headless = true;
    if (args[i] === '--mes' && args[i + 1]) opts.mes = parseInt(args[i + 1], 10);
  }
  return opts;
}

function numBR(v) {
  if (v == null || v === '' || v === '-') return 0;
  const s = String(v).replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function pad2(n) { return String(n).padStart(2, '0'); }

function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── LOGIN ─────────────────────────────────────────────────────────────────────

async function login(page) {
  console.log('>> Login no Trinks...');
  await page.goto('https://www.trinks.com/Login', { waitUntil: 'networkidle' });
  await sleep(2000);

  // Fechar banner de cookies
  const cookieBtn = await page.$('button:has-text("Aceitar"), a:has-text("Aceitar")');
  if (cookieBtn) {
    await cookieBtn.click();
    await sleep(500);
    console.log('>> Banner de cookies fechado');
  }

  // Preencher os 2 inputs visíveis (email + senha)
  const inputs = await page.$$('input:visible');
  if (inputs.length < 2) throw new Error('Campos de login não encontrados');
  await inputs[0].fill(TRINKS_EMAIL);
  await sleep(300);
  await inputs[1].fill(TRINKS_PASS);
  await sleep(300);

  // Submeter
  await page.click('button:has-text("Entrar"), a:has-text("Entrar")');
  await page.waitForLoadState('networkidle');
  await sleep(3000);

  // Se ainda está no login, tentar "Entrar como estabelecimento"
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
  console.log('>> Login OK:', page.url());
}

// ─── TROCAR UNIDADE ────────────────────────────────────────────────────────────
// Dropdown de estabelecimento fica em #menuBackoffice no header
// Estrutura: .o-dropdown__js-toggle (clica para abrir) → .o-dropdown__menu-item (opções)

async function trocarUnidade(page, unidade) {
  console.log(`>> Trocando para unidade: ${unidade.trinks}`);

  // Verificar se já está na unidade correta
  const current = await page.$eval(
    '#menuBackoffice .c-header__container-flex-select__customized-select',
    el => el.innerText.trim()
  ).catch(() => '');
  if (current.includes(unidade.trinks) || current.includes(unidade.nome)) {
    console.log(`>> Já na unidade ${unidade.trinks}`);
    return true;
  }

  // 1. Clicar no toggle para abrir o dropdown
  await page.click('#menuBackoffice [data-cy="dropdown-estabelecimentos"]');
  await sleep(800);

  // 2. Clicar na unidade desejada (é um <a class="o-dropdown__menu-item">)
  const items = await page.$$('#menuBackoffice .o-dropdown__menu-item');
  for (const item of items) {
    const text = await item.innerText();
    if (text.trim() === unidade.trinks) {
      await item.click();
      await page.waitForLoadState('networkidle');
      await sleep(3000);
      console.log(`>> Unidade trocada para: ${unidade.trinks}`);
      return true;
    }
  }

  console.warn(`>> AVISO: não encontrou ${unidade.trinks} no dropdown`);
  return false;
}

// ─── EXTRAIR DADOS DO RELATÓRIO FINANCEIRO ─────────────────────────────────────

async function extrairMes(page, unidade, ano, mes) {
  const ini = `01/${pad2(mes)}/${ano}`;
  const lastDay = lastDayOfMonth(ano, mes);
  const fim = `${lastDay}/${pad2(mes)}/${ano}`;
  console.log(`>> Filtrando: ${ini} a ${fim}`);

  // 1. Selecionar TipoData = "Data de Atendimento/Venda" (value=1)
  await page.selectOption('#TipoData', '1');
  await sleep(300);

  // 2. Preencher DataInicio e DataFim
  await page.fill('#DataInicio', '');
  await page.fill('#DataInicio', ini);
  await sleep(200);
  await page.fill('#DataFim', '');
  await page.fill('#DataFim', fim);
  await sleep(200);

  // 3. Clicar Filtrar
  await page.click('#filtrar');
  await page.waitForLoadState('networkidle');
  await sleep(3000);

  // 4. Extrair dados da tabela
  // A tabela do Trinks tem rows com class "padding-td" para resumos:
  //   - Resumo do mês: ["", "Julho / 2026", clientes, atend, ticket, servicos, ...]
  //   - Resumo do dia: ["", "dd/mm/yyyy (dia)", clientes, atend, ticket, servicos, ...]
  // Colunas (índices): 0=vazio, 1=data, 2=clientes, 3=atend, 4=ticket,
  //   5=serviços, 6=produtos, 7=pacotes, 8=VP, 9=CC, 10=descontos,
  //   11=crédito, 12=débito, 13=dinheiro, 14=prépago, 15=outros,
  //   16=troco, 17=gorjeta, 18=total, 19=vazio

  const dailyData = [];

  const rows = await page.$$eval('table tr.padding-td', trs =>
    trs.map(tr => [...tr.querySelectorAll('td')].map(td => td.innerText.trim()))
  );

  for (const cells of rows) {
    if (cells.length < 15) continue;
    // Procurar célula com data dd/mm/yyyy (ignorar mês "Julho / 2026")
    const dateCell = cells.find(c => /^\d{2}\/\d{2}\/\d{4}/.test(c));
    if (!dateCell) continue;
    const dateStr = dateCell.match(/^(\d{2}\/\d{2}\/\d{4})/)[1];
    const idx = cells.indexOf(dateCell);

    // Pegar tudo após a data
    const after = cells.slice(idx + 1).map(numBR);
    // after: [0]=clientes, [1]=atend, [2]=ticket, [3]=servicos, [4]=produtos,
    //        [5]=pacotes, [6]=VP, [7]=CC, [8]=descontos, [9]=crédito,
    //        [10]=débito, [11]=dinheiro, [12]=prépago, [13]=outros,
    //        [14]=troco, [15]=gorjeta, [16]=total, [17]=vazio

    if (after.length >= 15) {
      dailyData.push({
        data: dateStr,
        servicos: after[3],
        produtos: after[4],
        pacotes: after[5],
        vale_presente: after[6],
        credito_cliente: after[7],
        descontos: after[8],
        total_recebido: after[16] || after[after.length - 2] || 0,
      });
    }
  }

  // Fallback: se não encontrou rows com class padding-td, tentar todas as rows
  if (dailyData.length === 0) {
    console.log('>> Fallback: buscando em todas as rows...');
    const allRows = await page.$$eval('table tr', trs =>
      trs.map(tr => ({
        className: tr.className,
        cells: [...tr.querySelectorAll('td')].map(td => td.innerText.trim())
      }))
    );

    for (const row of allRows) {
      // Pular rows de transações individuais (têm classe diferente ou contêm horário)
      if (row.cells.some(c => /^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/.test(c))) continue;
      // Pular rows "Total" e headers
      if (row.cells.some(c => /^(Total|Atendimento|Resumo|Data de|Mês)/i.test(c))) continue;

      const dateCell = row.cells.find(c => /^\d{2}\/\d{2}\/\d{4}\s*\(/.test(c));
      if (!dateCell) continue;
      const dateStr = dateCell.match(/^(\d{2}\/\d{2}\/\d{4})/)[1];
      const idx = row.cells.indexOf(dateCell);
      const after = row.cells.slice(idx + 1).map(numBR);

      if (after.length >= 15) {
        dailyData.push({
          data: dateStr,
          servicos: after[3],
          produtos: after[4],
          pacotes: after[5],
          vale_presente: after[6],
          credito_cliente: after[7],
          descontos: after[8],
          total_recebido: after[16] || after[after.length - 2] || 0,
        });
      }
    }
  }

  console.log(`>> ${unidade.trinks} ${pad2(mes)}/${ano}: ${dailyData.length} dias extraídos`);
  return dailyData;
}

function getMesLabel(mes, ano) {
  const nomes = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${nomes[mes]} / ${ano}`;
}

// ─── SALVAR JSON ───────────────────────────────────────────────────────────────

function salvarJSON(unidade, ano, mes, dailyData) {
  const label = `${ano}-${pad2(mes)}`;
  const ini = `01/${pad2(mes)}/${ano}`;
  const lastDay = lastDayOfMonth(ano, mes);
  const fim = `${lastDay}/${pad2(mes)}/${ano}`;

  const json = {
    unidade: unidade.trinks,
    periodo: { ini, fim, label },
    dados_diarios: dailyData,
    scrape_timestamp: new Date().toISOString(),
  };

  const outFile = path.join(TRINKS_DIR, `${unidade.slug}_${label}.json`);
  fs.mkdirSync(TRINKS_DIR, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(json, null, 2));
  console.log(`>> Salvo: ${outFile}`);
}

// ─── GERAR XLSX ────────────────────────────────────────────────────────────────

function gerarXLSX(allData) {
  const rows = [];

  for (const { unidade, dados } of allData) {
    for (const d of dados) {
      const fatComercial = (d.servicos || 0) + (d.produtos || 0) + (d.pacotes || 0);
      rows.push({
        'Unidade': unidade.trinks,
        'Data': d.data,
        'Serviços (R$)': d.servicos || 0,
        'Produtos (R$)': d.produtos || 0,
        'Pacotes (R$)': d.pacotes || 0,
        'Vale-Presente (R$)': d.vale_presente || 0,
        'Crédito Cliente (R$)': d.credito_cliente || 0,
        'Descontos (R$)': d.descontos || 0,
        'Total Recebido (R$)': d.total_recebido || 0,
        'Faturamento Comercial (R$)': fatComercial,
      });
    }
  }

  rows.sort((a, b) => {
    if (a['Unidade'] !== b['Unidade']) return a['Unidade'].localeCompare(b['Unidade']);
    const [da, ma, ya] = a['Data'].split('/');
    const [db, mb, yb] = b['Data'].split('/');
    return new Date(`${ya}-${ma}-${da}`) - new Date(`${yb}-${mb}-${db}`);
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Faturamento Diário');
  XLSX.writeFile(wb, XLSX_OUT);
  console.log(`\n>> XLSX gerado: ${XLSX_OUT}`);
  console.log(`>> ${rows.length} linhas de faturamento diário`);
}

// ─── CARREGAR JSONs EXISTENTES ─────────────────────────────────────────────────

function carregarJSONsExistentes(ano) {
  const allData = [];
  for (const unidade of UNIDADES) {
    const dados = [];
    for (let m = 1; m <= 12; m++) {
      const now = new Date();
      if (ano === now.getFullYear() && m > now.getMonth() + 1) break;
      const label = `${ano}-${pad2(m)}`;
      const jsonFile = path.join(TRINKS_DIR, `${unidade.slug}_${label}.json`);
      if (!fs.existsSync(jsonFile)) continue;
      try {
        const json = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
        if (json.dados_diarios) {
          dados.push(...json.dados_diarios);
        } else if (json.resumo_tabelas) {
          dados.push(...parseOldJSON(json));
        }
      } catch (e) {
        console.warn(`>> AVISO: erro lendo ${jsonFile}: ${e.message}`);
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
  const now = new Date();
  const mesAtual = now.getMonth() + 1;
  const meses = opts.mes ? [opts.mes] : Array.from({ length: mesAtual }, (_, i) => i + 1);

  console.log(`\n=== SCRAPE TRINKS ${ANO} ===`);
  console.log(`Meses: ${meses.join(', ')}`);
  console.log(`Unidades: ${UNIDADES.map(u => u.trinks).join(', ')}`);
  console.log(`Headless: ${opts.headless}\n`);

  const browser = await chromium.launch({
    headless: opts.headless,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: 'pt-BR',
  });
  const page = await context.newPage();

  try {
    await login(page);

    const scrapedData = [];

    for (const unidade of UNIDADES) {
      const unidadeDados = [];

      // Trocar unidade via dropdown do header
      // Navegar ao relatório (a troca de unidade é global no Trinks)
      await page.goto(REPORT_URL, { waitUntil: 'networkidle' });
      await sleep(2000);

      // Trocar unidade: clicar no dropdown do header que mostra a unidade atual
      await trocarUnidade(page, unidade);

      // Recarregar a página de relatório após trocar unidade
      await page.goto(REPORT_URL, { waitUntil: 'networkidle', timeout: 60000 });
      await sleep(2000);

      for (const mes of meses) {
        console.log(`\n--- ${unidade.trinks} / ${pad2(mes)}/${ANO} ---`);

        const dailyData = await extrairMes(page, unidade, ANO, mes);

        if (dailyData.length > 0) {
          salvarJSON(unidade, ANO, mes, dailyData);
          unidadeDados.push(...dailyData);
        } else {
          console.warn(`>> AVISO: nenhum dado para ${unidade.trinks} ${pad2(mes)}/${ANO}`);
          // Screenshot para debug
          const ssName = `debug_${unidade.slug}_${ANO}-${pad2(mes)}.png`;
          await page.screenshot({ path: path.join(TRINKS_DIR, ssName), fullPage: true });
          console.log(`>> Screenshot: ${ssName}`);
        }
      }

      if (unidadeDados.length > 0) {
        scrapedData.push({ unidade, dados: unidadeDados });
      }
    }

    // Complementar com JSONs existentes
    const existingData = carregarJSONsExistentes(ANO);
    const mergedData = mergeData(scrapedData, existingData);

    gerarXLSX(mergedData);

    console.log('\n=== SCRAPE CONCLUÍDO ===');
    console.log(`Total unidades: ${mergedData.length}`);
    console.log(`Total dias: ${mergedData.reduce((s, d) => s + d.dados.length, 0)}`);

  } catch (err) {
    console.error('\n>> ERRO:', err.message);
    const ssPath = path.join(TRINKS_DIR, `debug_${Date.now()}.png`);
    await page.screenshot({ path: ssPath, fullPage: true }).catch(() => {});
    console.log(`>> Screenshot: ${ssPath}`);

    // Fallback: gerar XLSX dos JSONs existentes
    console.log('\n>> Fallback: gerando XLSX dos JSONs existentes...');
    const fallbackData = carregarJSONsExistentes(ANO);
    if (fallbackData.length > 0) gerarXLSX(fallbackData);
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
