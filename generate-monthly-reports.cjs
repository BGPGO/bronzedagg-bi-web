#!/usr/bin/env node
/**
 * generate-monthly-reports.cjs — gera report-2026-{MM}.json para cada mês Jan-Jun 2026.
 *
 * Carrega data/movimentos.json, agrega dados por mês usando a mesma lógica do
 * build-data.cjs (categoria_overrides), e gera relatórios financeiros com análise
 * baseada nos números reais.
 *
 * Saída: data/report-2026-01.json até data/report-2026-06.json
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const MOV_FILE = path.join(DATA_DIR, 'movimentos.json');

// ---------- categoria overrides (espelho do data.js / bi.config.js) ----------
const CAT_TIPO = {
  '1.1. Serviços de Bronze': 'receita',
  '1.2. Produtos': 'receita',
  '1.2.1. Produtos Franquias': 'receita',
  '1.3. Sublocação': 'receita',
  '1.5. Taxa Representação': 'receita',
  '1.6. Royalties Franquia': 'receita',
  '1.7. Taxa de Marketing': 'receita',
  '1.9. Café': 'receita',
  '1.10. Vendas TikTok': 'receita',
  '1.11. Taxa de Franquia': 'receita',
  'Receita não operacional': 'receita',
  'Receitas a identificar': 'receita',
  'Reembolso Studios': 'receita',
  'Juros recebidos': 'receita_fin',
  'Rendimento Aplicação': 'receita_fin',
  'Descontos Trinks': 'deducao',
  'Simples Nacional - DAS': 'deducao',
  'Devolução/Estorno Cliente': 'deducao',
  'ISS/Tributos': 'deducao',
  'ICMS': 'deducao',
  'CMV - Compra produtos fornecedor': 'custo',
  'CSP - Insumos': 'custo',
  'CSP - Produtos BGG': 'custo',
  'CSP - Produtos LABOTERRA': 'custo',
  'Deslocamento para atendimento': 'custo',
  'Aquisição de Bens e Insumos - Café GG House': 'custo',
  'Importação': 'custo',
  'Frete entre estoques': 'custo',
  'Custos de Maquininha': 'custo_venda',
  'Comissões': 'custo_venda',
  'Correios/Entrega': 'custo_venda',
  'Pagamento Profissional': 'desp_pessoal',
  'Mão de obra terceirizada': 'desp_pessoal',
  'Rescisão': 'desp_pessoal',
  '13º salário': 'desp_pessoal',
  'INSS': 'desp_pessoal',
  'FGTS': 'desp_pessoal',
  'Integrações/Presentes': 'desp_pessoal',
  'Kit de Cuidados Funcionárias': 'desp_pessoal',
  'Uniforme': 'desp_pessoal',
  'Aluguel': 'desp_operacao',
  'Condomínio': 'desp_operacao',
  'Luz': 'desp_operacao',
  'Telefone': 'desp_operacao',
  'Internet': 'desp_operacao',
  'Software e Sistema': 'desp_operacao',
  'Segurança': 'desp_operacao',
  'Decoração Operação': 'desp_operacao',
  'Serviço/Material de Limpeza': 'desp_operacao',
  'Lavanderia': 'desp_operacao',
  'Material de Escritório e Consumo': 'desp_operacao',
  'Manutenção': 'desp_operacao',
  'Seguro': 'desp_operacao',
  'Contador': 'desp_operacao',
  'Material para banheiro': 'desp_operacao',
  'Consumo Clientes': 'desp_operacao',
  'Pró-Labore': 'dna_pessoal',
  'Pagamento Profissional G&A': 'dna_pessoal',
  'Mão de obra terceirizada G&A': 'dna_pessoal',
  'Férias G&A': 'dna_pessoal',
  'Rescisão G&A': 'dna_pessoal',
  '13º salário G&A': 'dna_pessoal',
  'INSS G&A': 'dna_pessoal',
  'FGTS G&A': 'dna_pessoal',
  'Passagem/Vale Transporte': 'dna_pessoal',
  'Integrações/Presentes G&A': 'dna_pessoal',
  'Uniforme G&A': 'dna_pessoal',
  'Exames Periódicos': 'dna_pessoal',
  'Vale Alimentação G&A': 'dna_pessoal',
  'Plano de Saúde G&A': 'dna_pessoal',
  'Aluguel G&A': 'dna_admin',
  'Internet G&A': 'dna_admin',
  'Telefone - G&A': 'dna_admin',
  'Contador G&A': 'dna_admin',
  'Material de Escritório e Consumo G&A': 'dna_admin',
  'Serviço/Material de Limpeza  G&A': 'dna_admin',
  'Decoração Operação G&A': 'dna_admin',
  'Assessoria Jurídica': 'dna_admin',
  'Consultoria': 'dna_admin',
  'Taxas Bancárias': 'dna_admin',
  'Deslocamentos G&A': 'dna_admin',
  'Sistema G&A': 'dna_admin',
  'Despesas Processuais': 'dna_admin',
  'Despesas de Viagem': 'dna_admin',
  'Taxa de Alvará': 'dna_admin',
  'Despesas Judiciais': 'dna_admin',
  'Certificado Digital': 'dna_admin',
  'Design Gráfico': 'dna_marketing',
  'Agência Marketing': 'dna_marketing',
  'Influenciadoras': 'dna_marketing',
  'Mídia Paga': 'dna_marketing',
  'Relacionamento clientes/fornecedores': 'dna_marketing',
  'Material Gráfico': 'dna_marketing',
  'Eventos Marketing': 'dna_marketing',
  'Software de Marketing': 'dna_marketing',
  'Assessoria Site': 'dna_marketing',
  'Treinamentos G&A': 'dna_invest',
  'Despesas a identificar': 'nao_identificado',
  'Cartão de crédito': 'nao_identificado',
  'Juros e Multas': 'despesa_fin',
  'IOF': 'despesa_fin',
  'Dividendos': 'distribuicao',
  'Empréstimo - Amortização': 'financeiro',
  '16. CAPEX': 'invest_unidade',
  'Aquisição de Bens': 'invest_unidade',
  'Projetos Estratégicos e Reformas': 'invest_unidade',
  'Saldo Inicial': 'transferencia',
  'Transferência de Entrada': 'transferencia',
  'Transferência de Saída': 'transferencia',
  'Transferência entre Contas - Entradas': 'transferencia',
  'Transferência entre Contas - Saídas': 'transferencia',
  'Movimentações Entrada - SunGlow': 'transferencia',
  'Movimentações Saída - SunGlow': 'transferencia',
  'Estorno - Entrada': 'transferencia',
  'Estorno - Saída': 'transferencia',
};

const SKIP_TIPOS = new Set(['transferencia', 'distribuicao', 'financeiro', 'nao_identificado']);
const RECEITA_TIPOS = new Set(['receita', 'receita_fin']);
const DEDUCAO_TIPOS = new Set(['deducao']);
const CUSTO_TIPOS = new Set(['custo']);
const CUSTO_VENDA_TIPOS = new Set(['custo_venda']);
const DESP_PESSOAL_TIPOS = new Set(['desp_pessoal']);
const DESP_OPERACAO_TIPOS = new Set(['desp_operacao']);
const DNA_TIPOS = new Set(['dna_pessoal', 'dna_admin', 'dna_marketing', 'dna_invest']);

const MONTHS_FULL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const TRINKS_UNITS = ['Menino Deus', 'GG House', 'Alphaville', 'Itaim'];

// ---------- helpers ----------
function fmt(n) {
  if (n == null || isNaN(n)) return 'R$ 0,00';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const parts = abs.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}R$ ${parts[0]},${parts[1]}`;
}

function fmtK(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e6) return `${sign}R$ ${(abs / 1e6).toFixed(1).replace('.', ',')} M`;
  if (abs >= 1e3) return `${sign}R$ ${(abs / 1e3).toFixed(1).replace('.', ',')} K`;
  return `${sign}R$ ${abs.toFixed(0)}`;
}

function pct(n) {
  return `${n.toFixed(1).replace('.', ',')}%`;
}

function varPct(curr, prev) {
  if (!prev || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

// ---------- carregar dados ----------
console.log('Carregando movimentos.json...');
const movimentos = JSON.parse(fs.readFileSync(MOV_FILE, 'utf8'));
console.log(`  ${movimentos.length} movimentos carregados`);

// ---------- agregar por mês ----------
function aggregateMonth(monthNum) {
  const ym = `2026-${String(monthNum).padStart(2, '0')}`;
  const rows = movimentos.filter(r =>
    r.data_competencia &&
    r.data_competencia.startsWith(ym) &&
    !r.is_transferencia &&
    r.realizado
  );

  const result = {
    receita_bruta: 0,
    deducoes: 0,
    custos: 0,
    custos_venda: 0,
    desp_pessoal: 0,
    desp_operacao: 0,
    dna: { pessoal: 0, admin: 0, marketing: 0, invest: 0 },
    despesa_fin: 0,
    receita_fin: 0,
    receita_cats: {},
    despesa_cats: {},
    receita_units: {},
    despesa_units: {},
    trinks_units: {},
    trinks_total: 0,
    ca_total: 0,
    total_rows: rows.length,
  };

  rows.forEach(r => {
    const cat = r.categoria;
    const tipo = CAT_TIPO[cat];
    const unit = r.centro_custo || 'Sem CC';
    const val = Math.abs(r.valor_total);

    if (!tipo || SKIP_TIPOS.has(tipo)) return;

    if (RECEITA_TIPOS.has(tipo)) {
      result.receita_bruta += val;
      result.receita_cats[cat] = (result.receita_cats[cat] || 0) + val;
      result.receita_units[unit] = (result.receita_units[unit] || 0) + val;
      if (tipo === 'receita_fin') result.receita_fin += val;
    } else if (DEDUCAO_TIPOS.has(tipo)) {
      result.deducoes += val;
    } else if (CUSTO_TIPOS.has(tipo)) {
      result.custos += val;
    } else if (CUSTO_VENDA_TIPOS.has(tipo)) {
      result.custos_venda += val;
    } else if (DESP_PESSOAL_TIPOS.has(tipo)) {
      result.desp_pessoal += val;
    } else if (DESP_OPERACAO_TIPOS.has(tipo)) {
      result.desp_operacao += val;
    } else if (DNA_TIPOS.has(tipo)) {
      if (tipo === 'dna_pessoal') result.dna.pessoal += val;
      else if (tipo === 'dna_admin') result.dna.admin += val;
      else if (tipo === 'dna_marketing') result.dna.marketing += val;
      else if (tipo === 'dna_invest') result.dna.invest += val;
    } else if (tipo === 'despesa_fin') {
      result.despesa_fin += val;
    }

    // despesa_cats: tudo que nao é receita
    if (!RECEITA_TIPOS.has(tipo)) {
      result.despesa_cats[cat] = (result.despesa_cats[cat] || 0) + val;
      result.despesa_units[unit] = (result.despesa_units[unit] || 0) + val;
    }
  });

  // Trinks específico
  const trinks = movimentos.filter(r =>
    r.fonte === 'trinks' &&
    r.data_competencia &&
    r.data_competencia.startsWith(ym)
  );
  trinks.forEach(r => {
    const u = r.centro_custo || 'Outros';
    result.trinks_units[u] = (result.trinks_units[u] || 0) + Math.abs(r.valor_total);
    result.trinks_total += Math.abs(r.valor_total);
  });

  // CA total
  const ca = movimentos.filter(r =>
    r.fonte === 'conta-azul' &&
    r.data_competencia &&
    r.data_competencia.startsWith(ym) &&
    !r.is_transferencia &&
    r.realizado &&
    r.natureza === 'P'
  );
  ca.forEach(r => { result.ca_total += Math.abs(r.valor_total); });

  // Computed DRE
  result.receita_liquida = result.receita_bruta - result.deducoes;
  result.lucro_bruto = result.receita_liquida - result.custos - result.custos_venda;
  result.resultado_operacional = result.lucro_bruto - result.desp_pessoal - result.desp_operacao;
  result.total_dna = result.dna.pessoal + result.dna.admin + result.dna.marketing + result.dna.invest;
  result.ebitda = result.resultado_operacional - result.total_dna;
  result.margem_bruta = result.receita_liquida > 0 ? (result.lucro_bruto / result.receita_liquida) * 100 : 0;
  result.margem_operacional = result.receita_liquida > 0 ? (result.resultado_operacional / result.receita_liquida) * 100 : 0;
  result.margem_ebitda = result.receita_liquida > 0 ? (result.ebitda / result.receita_liquida) * 100 : 0;
  result.total_despesas = result.deducoes + result.custos + result.custos_venda +
    result.desp_pessoal + result.desp_operacao + result.total_dna + result.despesa_fin;

  return result;
}

// ---------- agregar todos os meses ----------
const allMonths = {};
for (let m = 1; m <= 6; m++) {
  allMonths[m] = aggregateMonth(m);
}

// ---------- gerar relatório para cada mês ----------
function topEntries(obj, n = 5) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
}

function generateReport(monthNum) {
  const d = allMonths[monthNum];
  const mesNome = MONTHS_FULL[monthNum - 1];
  const prev = monthNum > 1 ? allMonths[monthNum - 1] : null;

  // Variações MoM
  const varReceita = prev ? varPct(d.receita_bruta, prev.receita_bruta) : null;
  const varDespesa = prev ? varPct(d.total_despesas, prev.total_despesas) : null;
  const varTrinks = prev ? varPct(d.trinks_total, prev.trinks_total) : null;

  // Top categorias
  const topRec = topEntries(d.receita_cats, 5);
  const topDesp = topEntries(d.despesa_cats, 5);
  const topRecUnits = topEntries(d.receita_units, 6);
  const topDespUnits = topEntries(d.despesa_units, 6);

  // Trinks ranking
  const trinksSorted = Object.entries(d.trinks_units).sort((a, b) => b[1] - a[1]);
  const trinksBest = trinksSorted[0] || ['N/A', 0];
  const trinksWorst = trinksSorted[trinksSorted.length - 1] || ['N/A', 0];

  // Unit com melhor e pior margem
  const unitMargins = {};
  for (const [unit, rec] of Object.entries(d.receita_units)) {
    const desp = d.despesa_units[unit] || 0;
    unitMargins[unit] = rec > 0 ? ((rec - desp) / rec) * 100 : 0;
  }
  const unitMarginsSorted = Object.entries(unitMargins).sort((a, b) => b[1] - a[1]);

  // --- Resumo Executivo ---
  let resumo = `Em ${mesNome} de 2026, o Grupo Bronze da GG registrou receita bruta de ${fmt(d.receita_bruta)}, `;
  if (varReceita !== null) {
    resumo += `representando uma ${varReceita >= 0 ? 'alta' : 'queda'} de ${pct(Math.abs(varReceita))} em relação ao mês anterior. `;
  }
  resumo += `A receita líquida (após deduções de ${fmt(d.deducoes)}) atingiu ${fmt(d.receita_liquida)}. `;
  resumo += `O lucro bruto foi de ${fmt(d.lucro_bruto)}, com margem bruta de ${pct(d.margem_bruta)}. `;
  resumo += `O resultado operacional ficou em ${fmt(d.resultado_operacional)} (margem operacional de ${pct(d.margem_operacional)}). `;
  resumo += `O faturamento Trinks totalizou ${fmt(d.trinks_total)}, com destaque para a unidade ${trinksBest[0]} (${fmt(trinksBest[1])}).`;

  // --- Destaques ---
  const destaques = [];
  destaques.push(`Receita bruta de ${fmt(d.receita_bruta)} no mês, sendo ${fmt(topRec[0][1])} em ${topRec[0][0]} (${pct((topRec[0][1] / d.receita_bruta) * 100)} do total).`);
  destaques.push(`Faturamento Trinks de ${fmt(d.trinks_total)} — unidade líder: ${trinksBest[0]} com ${fmt(trinksBest[1])} (${pct((trinksBest[1] / d.trinks_total) * 100)} do Trinks).`);
  if (unitMarginsSorted.length > 0) {
    destaques.push(`Melhor margem por unidade: ${unitMarginsSorted[0][0]} com ${pct(unitMarginsSorted[0][1])} de margem de contribuição.`);
  }
  destaques.push(`Margem bruta de ${pct(d.margem_bruta)} e margem operacional de ${pct(d.margem_operacional)}.`);
  if (d.custos > 0) {
    destaques.push(`Custos diretos (CMV + CSP) totalizaram ${fmt(d.custos)}, representando ${pct((d.custos / d.receita_bruta) * 100)} da receita bruta.`);
  }

  // --- Alertas ---
  const alertas = [];
  if (varReceita !== null && varReceita < -10) {
    alertas.push(`Queda significativa de ${pct(Math.abs(varReceita))} na receita bruta em relação a ${MONTHS_FULL[monthNum - 2]}. Necessário investigar causas e mitigar.`);
  }
  if (d.margem_bruta < 60) {
    alertas.push(`Margem bruta de ${pct(d.margem_bruta)} está abaixo do patamar ideal de 65%. Custos diretos devem ser revisados.`);
  }
  if (d.margem_operacional < 30) {
    alertas.push(`Margem operacional de ${pct(d.margem_operacional)} abaixo de 30%. Despesas operacionais e de pessoal merecem atenção.`);
  }
  if (d.deducoes / d.receita_bruta > 0.12) {
    alertas.push(`Deduções representam ${pct((d.deducoes / d.receita_bruta) * 100)} da receita bruta — acima de 12%. Verificar carga tributária e descontos Trinks.`);
  }
  if (trinksWorst[1] < trinksBest[1] * 0.15) {
    alertas.push(`Unidade ${trinksWorst[0]} com faturamento Trinks de apenas ${fmt(trinksWorst[1])}, significativamente abaixo das demais. Avaliar ações de recuperação.`);
  }
  // DNA check
  if (d.total_dna > d.resultado_operacional * 0.5 && d.total_dna > 0) {
    alertas.push(`Despesas G&A (DNA) de ${fmt(d.total_dna)} representam parcela elevada do resultado operacional. Otimizar estrutura corporativa.`);
  }
  if (alertas.length === 0) {
    alertas.push(`Indicadores financeiros dentro dos parâmetros esperados para o período.`);
  }

  // --- Recomendações ---
  const recomendacoes = [];
  // Trinks unit recommendations
  if (trinksSorted.length >= 2) {
    const gap = trinksBest[1] - trinksWorst[1];
    recomendacoes.push(`Replicar as práticas comerciais da unidade ${trinksBest[0]} nas demais, especialmente em ${trinksWorst[0]}. O gap entre melhor e pior unidade é de ${fmt(gap)}.`);
  }
  // Custo recommendations
  if (d.custos > d.receita_bruta * 0.25) {
    recomendacoes.push(`Negociar melhores condições com fornecedores de produtos (LABOTERRA, CMV). Os custos diretos de ${fmt(d.custos)} estão pressionando a margem bruta.`);
  } else {
    recomendacoes.push(`Manter controle rigoroso sobre custos diretos (atualmente ${fmt(d.custos)}). Buscar ganhos de escala nas compras de produtos e insumos.`);
  }
  // Deducao recommendations
  if (d.deducoes > 0) {
    const descTrinsVal = d.despesa_cats['Descontos Trinks'] || 0;
    if (descTrinsVal > d.deducoes * 0.3) {
      recomendacoes.push(`Descontos Trinks representam ${fmt(descTrinsVal)} (${pct((descTrinsVal / d.deducoes) * 100)} das deduções). Avaliar política de descontos e promoções para otimizar receita líquida.`);
    }
  }
  // Growth recommendations
  if (varReceita !== null && varReceita < 0) {
    recomendacoes.push(`Implementar campanhas de captação e retenção de clientes para reverter a tendência de queda de ${pct(Math.abs(varReceita))} na receita.`);
  } else if (varReceita !== null && varReceita > 15) {
    recomendacoes.push(`Aproveitar o momentum de crescimento de ${pct(varReceita)} para investir em capacitação da equipe e melhoria da experiência do cliente.`);
  }
  // Operational efficiency
  recomendacoes.push(`Monitorar despesas operacionais fixas (aluguel, condomínio, sistemas), que somaram ${fmt(d.desp_operacao)} no mês, buscando renegociação de contratos onde possível.`);

  // --- Análise Receita ---
  let analise_receita = `A receita bruta de ${mesNome}/2026 foi de ${fmt(d.receita_bruta)}`;
  if (varReceita !== null) {
    analise_receita += `, variação de ${varReceita >= 0 ? '+' : ''}${pct(varReceita)} vs. ${MONTHS_FULL[monthNum - 2]}`;
  }
  analise_receita += `. A principal fonte de receita continua sendo Serviços de Bronze com ${fmt(topRec[0][1])} (${pct((topRec[0][1] / d.receita_bruta) * 100)} do total), seguido por Produtos com ${fmt(topRec[1] ? topRec[1][1] : 0)}. `;
  analise_receita += `Por unidade, ${topRecUnits[0][0]} lidera com ${fmt(topRecUnits[0][1])}`;
  if (topRecUnits.length > 1) {
    analise_receita += `, seguido por ${topRecUnits[1][0]} (${fmt(topRecUnits[1][1])})`;
  }
  analise_receita += `. `;
  analise_receita += `O faturamento Trinks (serviços agendados via plataforma) totalizou ${fmt(d.trinks_total)}. `;
  analise_receita += `Distribuição Trinks por unidade: `;
  analise_receita += trinksSorted.map(([u, v]) => `${u}: ${fmt(v)}`).join(', ') + '. ';
  const concReceita = d.receita_bruta - d.receita_liquida;
  analise_receita += `As deduções totais (impostos, descontos, estornos) somaram ${fmt(d.deducoes)}, resultando em receita líquida de ${fmt(d.receita_liquida)}.`;

  // --- Análise Despesa ---
  let analise_despesa = `As despesas totais classificadas (excluindo transferências e dividendos) somaram ${fmt(d.total_despesas)} em ${mesNome}/2026`;
  if (varDespesa !== null) {
    analise_despesa += ` (${varDespesa >= 0 ? '+' : ''}${pct(varDespesa)} vs. mês anterior)`;
  }
  analise_despesa += `. `;
  analise_despesa += `Composição: Deduções ${fmt(d.deducoes)}, Custos diretos ${fmt(d.custos)}, Custos de venda ${fmt(d.custos_venda)}, `;
  analise_despesa += `Despesas de pessoal (operação) ${fmt(d.desp_pessoal)}, Despesas operacionais ${fmt(d.desp_operacao)}`;
  if (d.total_dna > 0) {
    analise_despesa += `, G&A (DNA) ${fmt(d.total_dna)}`;
  }
  analise_despesa += `. `;
  analise_despesa += `As 5 maiores categorias de despesa são: `;
  analise_despesa += topDesp.map(([cat, val]) => `${cat} (${fmt(val)})`).join(', ') + '. ';
  analise_despesa += `Por unidade de custo: `;
  analise_despesa += topDespUnits.map(([u, v]) => `${u}: ${fmt(v)}`).join(', ') + '.';

  // --- Análise Resultado ---
  let analise_resultado = `O DRE de ${mesNome}/2026 apresenta: Receita Bruta ${fmt(d.receita_bruta)} → Receita Líquida ${fmt(d.receita_liquida)} (deduções de ${fmt(d.deducoes)}). `;
  analise_resultado += `Lucro Bruto de ${fmt(d.lucro_bruto)} (margem bruta ${pct(d.margem_bruta)}), após custos diretos de ${fmt(d.custos)} e custos de venda de ${fmt(d.custos_venda)}. `;
  analise_resultado += `O Resultado Operacional ficou em ${fmt(d.resultado_operacional)} (margem operacional ${pct(d.margem_operacional)}), descontando despesas de pessoal (${fmt(d.desp_pessoal)}) e operacionais (${fmt(d.desp_operacao)}). `;
  if (d.total_dna > 0) {
    analise_resultado += `Após despesas G&A de ${fmt(d.total_dna)}, o EBITDA proxy foi de ${fmt(d.ebitda)} (margem de ${pct(d.margem_ebitda)}). `;
  }
  if (prev) {
    const prevResult = prev.resultado_operacional;
    const varResult = varPct(d.resultado_operacional, prevResult);
    if (varResult !== null) {
      analise_resultado += `Comparado a ${MONTHS_FULL[monthNum - 2]}, o resultado operacional ${varResult >= 0 ? 'cresceu' : 'caiu'} ${pct(Math.abs(varResult))}. `;
    }
  }
  analise_resultado += `O grupo mantém concentração de receita na unidade Itaim, que respondeu por ${pct((d.receita_units['Itaim'] || 0) / d.receita_bruta * 100)} da receita total.`;

  // --- Indicadores ---
  const indicadores = {
    receita_bruta: Math.round(d.receita_bruta * 100) / 100,
    receita_liquida: Math.round(d.receita_liquida * 100) / 100,
    lucro_bruto: Math.round(d.lucro_bruto * 100) / 100,
    resultado_operacional: Math.round(d.resultado_operacional * 100) / 100,
    margem_bruta: Math.round(d.margem_bruta * 100) / 100,
    margem_operacional: Math.round(d.margem_operacional * 100) / 100,
    margem_ebitda: Math.round(d.margem_ebitda * 100) / 100,
    total_despesas: Math.round(d.total_despesas * 100) / 100,
    custos_diretos: Math.round(d.custos * 100) / 100,
    custos_venda: Math.round(d.custos_venda * 100) / 100,
    deducoes: Math.round(d.deducoes * 100) / 100,
    desp_pessoal: Math.round(d.desp_pessoal * 100) / 100,
    desp_operacao: Math.round(d.desp_operacao * 100) / 100,
    total_dna: Math.round(d.total_dna * 100) / 100,
    trinks_total: Math.round(d.trinks_total * 100) / 100,
    trinks_por_unidade: Object.fromEntries(
      Object.entries(d.trinks_units).map(([k, v]) => [k, Math.round(v * 100) / 100])
    ),
    receita_por_unidade: Object.fromEntries(
      topEntries(d.receita_units, 10).map(([k, v]) => [k, Math.round(v * 100) / 100])
    ),
    var_receita_mom: varReceita !== null ? Math.round(varReceita * 100) / 100 : null,
    var_trinks_mom: varTrinks !== null ? Math.round(varTrinks * 100) / 100 : null,
  };

  return {
    mes: mesNome,
    ano: 2026,
    gerado_em: new Date().toISOString(),
    resumo,
    destaques,
    alertas,
    recomendacoes,
    analise_receita,
    analise_despesa,
    analise_resultado,
    indicadores,
  };
}

// ---------- gerar e salvar ----------
for (let m = 1; m <= 6; m++) {
  const report = generateReport(m);
  const outFile = path.join(DATA_DIR, `report-2026-${String(m).padStart(2, '0')}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf8');
  const size = (fs.statSync(outFile).size / 1024).toFixed(1);
  console.log(`  ${path.basename(outFile)} gerado (${size} KB) — ${report.mes}/2026`);
}

console.log('\n=== Todos os 6 relatórios gerados com sucesso ===');
