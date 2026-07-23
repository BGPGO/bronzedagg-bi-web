/**
 * Adapter: Bronze da GG (Conta Azul XLSX + Trinks XLSX)
 *
 * Fontes:
 *   - extrato_financeiroBronzedagg.xlsx → movimentos (despesas, receitas CA)
 *   - faturamento_trinks_2026.xlsx     → faturamento (Trinks = fonte verdade de receita)
 *
 * Regras:
 *   - Faturamento 100% do Trinks (não usar receita do CA para faturamento)
 *   - Todo o resto (despesas, DRE, DFC, saldos) vem do Conta Azul
 *   - Competência é a régua (exceto DFC que é por caixa)
 *   - Centro de Custo do CA → direciona unidade
 *   - Categorias com "G&A" = DNA (rateado entre unidades por faturamento)
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');

function readSheet(file, sheetName) {
  const wb = XLSX.readFile(file);
  const sn = sheetName || wb.SheetNames[0];
  return XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: '' });
}

function num(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function isoDate(v) {
  if (!v) return null;
  if (typeof v === 'number' && v > 1000) {
    const ms = (v - 25569) * 86400 * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

// Mapa conta bancária → unidade
const CONTA_TO_UNIDADE = {
  'Itaú - Matriz': 'Matriz',
  'Inter - Matriz': 'Matriz',
  'Itaú - Franquias': 'Franquias',
  'Itaú - Itaim': 'Itaim',
  'Itaú - Menino Deus': 'Menino Deus',
  'Itaú - GG House': 'GG House',
  'Inter - GG House': 'GG House',
  'Itaú - Capão da Canoa': 'Capão',
  'Itaú - Alphaville': 'Alphaville',
  'Inter - Alphaville': 'Alphaville',
  'Itaú - Fundos de Investimentos': 'Matriz',
  'Cartão de Crédito - Bronze da GG': 'Matriz',
  'Cartão de Crédito Itaim': 'Itaim',
  'Cartão de Crédito - GG House': 'GG House',
  'Cartão de Crédito - Alphaville': 'Alphaville',
  'Cartão de Crédito Menino Deus': 'Menino Deus',
  'FLASH - Benefícios': 'Matriz',
};

// Unidades do grupo (entram no DRE/DFC consolidado)
const GRUPO_UNIDADES = ['Matriz', 'Franquias', 'Itaim', 'Menino Deus', 'GG House', 'Capão'];
// Franquias próprias (só faturamento, não entram no consolidado)
const FRANQUIAS_PROPRIAS = ['Alphaville', 'Carlos Gomes'];

// Categorias que são DNA/G&A (rateio entre unidades)
function isDNA(cat) {
  if (!cat) return false;
  return cat.includes('G&A') || cat.includes('G&a');
}

// Categorias de transferência (não entram no DRE)
function isTransferencia(cat) {
  if (!cat) return false;
  return cat.includes('Transferência') || cat.includes('Saldo Inicial') ||
    cat.includes('Movimentações Entrada') || cat.includes('Movimentações Saída');
}

module.exports = {
  id: 'bronzedagg',
  label: 'Bronze da GG (CA + Trinks)',
  required_env: [],

  validate(config) {
    const errors = [];
    const drive = config.fontes?.drive?.base_path;
    if (!drive) errors.push('config.fontes.drive.base_path não definido');
    else if (!fs.existsSync(drive)) errors.push(`drive base_path não existe: ${drive}`);
    const bgg = config.fontes?.bronzedagg;
    if (!bgg) errors.push('config.fontes.bronzedagg não definido');
    return { ok: errors.length === 0, errors };
  },

  async pull(config, dataDir) {
    fs.mkdirSync(dataDir, { recursive: true });
    const drive = config.fontes.drive.base_path;
    const bgg = config.fontes.bronzedagg;

    // ====== 1. CONTA AZUL (despesas + receitas operacionais) ======
    const caFile = path.join(drive, bgg.conta_azul_file);
    console.log('=== Lendo Conta Azul:', caFile);
    const caRows = readSheet(caFile);
    console.log(`  ${caRows.length} lançamentos`);

    const movimentos = [];
    let idCounter = 1;

    for (const r of caRows) {
      const tipo = r['Tipo'] || '';
      const cat = r['Categoria 1'] || '';
      const centroCusto = r['Centro de Custo 1...27'] || r['Centro de Custo 1'] || '';
      const contaBancaria = r['Conta bancária'] || '';
      const valor = num(r['Valor (R$)']);
      const valorOriginal = num(r['Valor original (R$)']);
      const desconto = num(r['Desconto (R$)']);
      const taxas = num(r['Taxas (R$)']);
      const juros = num(r['Juros (R$)']);
      const multa = num(r['Multa (R$)']);
      const situacao = r['Situação'] || '';
      const descricao = r['Descrição'] || '';
      const dataMovimento = isoDate(r['Data movimento']);
      const dataCompetencia = isoDate(r['Data de competência']);
      const dataVencimento = isoDate(r['Data original de vencimento']);

      // Resolver unidade: prioridade centro de custo, fallback conta bancária
      let unidade = centroCusto || CONTA_TO_UNIDADE[contaBancaria] || 'Sem unidade';
      // Normalizar nomes
      if (unidade === 'Capão da Canoa') unidade = 'Capão';

      const natureza = tipo === 'Receita' ? 'R' : 'P';
      // Realizado (caixa) no Conta Azul = dinheiro que efetivamente movimentou:
      // "Conciliado" (conciliado no extrato bancário) OU "Quitado" (baixado).
      // "Em aberto"/"Atrasado" = a vencer; "Transferido" = transferência.
      const realizado = situacao === 'Conciliado' || situacao === 'Quitado';

      // Tags
      const tags = [];
      if (isDNA(cat)) tags.push('DNA');
      if (isTransferencia(cat)) tags.push('TRANSFERENCIA');
      if (GRUPO_UNIDADES.includes(unidade)) tags.push('GRUPO');
      if (FRANQUIAS_PROPRIAS.includes(unidade)) tags.push('FRANQUIA_PROPRIA');

      movimentos.push({
        id: `CA-${idCounter++}`,
        fonte: 'conta-azul',
        natureza,
        status: realizado ? (natureza === 'R' ? 'RECEBIDO' : 'PAGO') : 'A VENCER',
        realizado,
        data_emissao: dataMovimento,
        data_vencimento: dataVencimento || dataMovimento,
        data_pagamento: realizado ? dataMovimento : null,
        data_competencia: dataCompetencia || dataMovimento,
        valor_total: Math.abs(valor),
        valor_pago: realizado ? Math.abs(valor) : 0,
        valor_aberto: realizado ? 0 : Math.abs(valor),
        categoria: cat,
        centro_custo: unidade,
        cliente: r['Nome do fornecedor/cliente'] || '',
        conta_corrente: contaBancaria,
        codigo_banco: '',
        observacao: descricao,
        tags,
        // Campos extras pro BI Bronze
        desconto,
        taxas,
        juros,
        multa,
        valor_original: valorOriginal,
        is_dna: isDNA(cat),
        is_transferencia: isTransferencia(cat),
        is_grupo: GRUPO_UNIDADES.includes(unidade),
      });
    }

    // ====== 2. TRINKS (faturamento) — fonte: Relatório Sistema ======
    const trFile = path.join(drive, bgg.trinks_file);
    const trSheet = bgg.trinks_sheet || 'Relatório Sistema';
    console.log('=== Lendo Trinks:', trFile, '→', trSheet);
    const trWb = XLSX.readFile(trFile);
    const trRows = XLSX.utils.sheet_to_json(trWb.Sheets[trSheet], { defval: '' });
    console.log(`  ${trRows.length} linhas no Relatório Sistema`);

    // Normalização de nomes de unidade do Trinks → padrão do BI
    const UNIT_NORM = {
      'ALPHAVILLE': 'Alphaville',
      'Alphaville': 'Alphaville',
      'ITAIM': 'Itaim',
      'Itaim': 'Itaim',
      'GG House': 'GG House',
      'Menino Deus': 'Menino Deus',
      'Carlos Gomes': 'Carlos Gomes',
      'Capão da Canoa': 'Capão',
      'Novo Hamburgo': 'Novo Hamburgo',
    };

    // Agregar por unidade + data de atendimento (competência)
    // Regra do Excel: 1.1. Serviços de Bronze = Serviços + Pacotes
    //                 1.2. Produtos = Produtos
    //                 Só Tipo="Pagamento" (excluir Estorno)
    let trCount = 0;
    for (const r of trRows) {
      const tipo = r['Tipo'] || '';
      if (tipo !== 'Pagamento') continue;

      const rawUnit = r['Centro de Custo'] || '';
      const unitNorm = UNIT_NORM[rawUnit] || rawUnit;
      if (!unitNorm) continue;

      // Data de Atendimento/Venda = competência
      const dataAtend = r['Data de Atendimento/Venda'];
      const data = isoDate(dataAtend);
      if (!data) continue;

      const servicos = num(r['Total (R$) Serviço']);
      const produtos = num(r['Total (R$) Produtos']);
      const pacotes = num(r['Total (R$) Pacotes']);
      const nomeCliente = r['Nome do Cliente'] || '';

      const tags = ['FATURAMENTO'];
      if (GRUPO_UNIDADES.includes(unitNorm)) tags.push('GRUPO');
      if (FRANQUIAS_PROPRIAS.includes(unitNorm)) tags.push('FRANQUIA_PROPRIA');

      // 1.1. Serviços de Bronze = Serviços + Pacotes (regra da planilha)
      const totalServicos = servicos + pacotes;
      if (totalServicos > 0) {
        movimentos.push({
          id: `TR-SRV-${idCounter++}`,
          fonte: 'trinks',
          natureza: 'R',
          status: 'RECEBIDO',
          realizado: true,
          data_emissao: data,
          data_vencimento: data,
          data_pagamento: data,
          data_competencia: data,
          valor_total: totalServicos,
          valor_pago: totalServicos,
          valor_aberto: 0,
          categoria: '1.1. Serviços de Bronze',
          centro_custo: unitNorm,
          cliente: nomeCliente || 'Faturamento Trinks',
          conta_corrente: '',
          codigo_banco: '',
          observacao: `Serviços ${unitNorm} ${data}`,
          tags,
          is_dna: false,
          is_transferencia: false,
          is_grupo: GRUPO_UNIDADES.includes(unitNorm),
        });
        trCount++;
      }

      // 1.2. Produtos
      if (produtos > 0) {
        movimentos.push({
          id: `TR-PRD-${idCounter++}`,
          fonte: 'trinks',
          natureza: 'R',
          status: 'RECEBIDO',
          realizado: true,
          data_emissao: data,
          data_vencimento: data,
          data_pagamento: data,
          data_competencia: data,
          valor_total: produtos,
          valor_pago: produtos,
          valor_aberto: 0,
          categoria: '1.2. Produtos',
          centro_custo: unitNorm,
          cliente: nomeCliente || 'Faturamento Trinks',
          conta_corrente: '',
          codigo_banco: '',
          observacao: `Produtos ${unitNorm} ${data}`,
          tags,
          is_dna: false,
          is_transferencia: false,
          is_grupo: GRUPO_UNIDADES.includes(unitNorm),
        });
        trCount++;
      }
    }
    console.log(`  ${trCount} lançamentos Trinks gerados`);

    console.log(`  Total movimentos consolidados: ${movimentos.length}`);
    console.log(`  - Conta Azul: ${movimentos.filter(m => m.fonte === 'conta-azul').length}`);
    console.log(`  - Trinks: ${movimentos.filter(m => m.fonte === 'trinks').length}`);

    // ====== 3. Gravar JSONs canonical ======
    fs.writeFileSync(path.join(dataDir, 'movimentos.json'), JSON.stringify(movimentos, null, 2));

    // Empresa
    fs.writeFileSync(path.join(dataDir, 'empresa.json'), JSON.stringify({
      nome_fantasia: 'Grupo Bronze da GG',
      fonte: 'bronzedagg',
    }));

    // Categorias
    const allCats = [...new Set(movimentos.map(m => m.categoria).filter(Boolean))].sort();
    const categorias = allCats.map(name => {
      let tipo = 'mista';
      // Determinar tipo baseado na natureza predominante
      const recs = movimentos.filter(m => m.categoria === name);
      const receitas = recs.filter(m => m.natureza === 'R').length;
      const despesas = recs.filter(m => m.natureza === 'P').length;
      if (receitas > despesas) tipo = 'receita';
      else if (despesas > receitas) tipo = 'despesa';
      return { codigo: name, descricao: name, tipo };
    });
    fs.writeFileSync(path.join(dataDir, 'categorias.json'), JSON.stringify(categorias, null, 2));

    // Departamentos (= unidades)
    const unidades = [...new Set(movimentos.map(m => m.centro_custo).filter(Boolean))].sort();
    const deps = unidades.map(u => ({
      codigo: u,
      descricao: u,
      is_grupo: GRUPO_UNIDADES.includes(u),
      is_franquia_propria: FRANQUIAS_PROPRIAS.includes(u),
    }));
    fs.writeFileSync(path.join(dataDir, 'departamentos.json'), JSON.stringify(deps, null, 2));

    // Clientes
    const clis = [...new Set(movimentos.map(m => m.cliente).filter(Boolean))].sort();
    fs.writeFileSync(path.join(dataDir, 'clientes.json'), JSON.stringify(
      clis.map(c => ({ codigo: c, nome_fantasia: c, razao_social: c })), null, 2
    ));

    // Contas correntes
    const ccs = [...new Set(movimentos.map(m => m.conta_corrente).filter(Boolean))].sort();
    fs.writeFileSync(path.join(dataDir, 'contas_correntes.json'), JSON.stringify(
      ccs.map(c => ({ id: c, nome: c, banco: c, codigo_banco: '', saldo_inicial: 0 })), null, 2
    ));

    // Summary
    const summaryData = {
      adapter: 'bronzedagg',
      timestamp: new Date().toISOString(),
      files: { conta_azul: caFile, trinks: trFile },
      records: movimentos.length,
      by_source: {
        conta_azul: movimentos.filter(m => m.fonte === 'conta-azul').length,
        trinks: movimentos.filter(m => m.fonte === 'trinks').length,
      },
      unidades: unidades,
    };
    fs.writeFileSync(path.join(dataDir, '_summary.json'), JSON.stringify(summaryData, null, 2));

    console.log(`=== Bronze da GG OK: ${movimentos.length} movimentos ===`);
    return { fetched: movimentos.length, summary: summaryData };
  },
};
