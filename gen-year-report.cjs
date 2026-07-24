#!/usr/bin/env node
'use strict';
const fs = require('fs');

const months = [];
let totalRec = 0, totalDesp = 0, totalCustos = 0, totalCustosVenda = 0, totalDed = 0;
let totalDespPessoal = 0, totalDespOp = 0, totalDna = 0, totalTrinks = 0;
const trinksByUnit = {};

for (let m = 1; m <= 6; m++) {
  const mm = String(m).padStart(2, '0');
  const f = `data/report-2026-${mm}.json`;
  if (!fs.existsSync(f)) continue;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  months.push(d);
  const ind = d.indicadores || {};
  totalRec += ind.receita_bruta || 0;
  totalDesp += ind.total_despesas || 0;
  totalCustos += ind.custos_diretos || 0;
  totalCustosVenda += ind.custos_venda || 0;
  totalDed += ind.deducoes || 0;
  totalDespPessoal += ind.desp_pessoal || 0;
  totalDespOp += ind.desp_operacao || 0;
  totalDna += ind.total_dna || 0;
  totalTrinks += ind.trinks_total || 0;
  if (ind.trinks_por_unidade) {
    for (const [u, v] of Object.entries(ind.trinks_por_unidade)) {
      trinksByUnit[u] = (trinksByUnit[u] || 0) + v;
    }
  }
}

const recLiq = totalRec - totalDed;
const lucroBruto = recLiq - totalCustos - totalCustosVenda;
const margemBruta = totalRec > 0 ? (lucroBruto / totalRec * 100) : 0;
const resultadoOp = lucroBruto - totalDespPessoal - totalDespOp - totalDna;
const margemOp = totalRec > 0 ? (resultadoOp / totalRec * 100) : 0;

const fmtM = (v) => 'R$' + (v / 1e6).toFixed(2).replace('.', ',') + 'M';
const fmtK = (v) => 'R$' + (Math.abs(v) / 1e3).toFixed(0) + 'K';
const fmtPct = (v) => v.toFixed(1).replace('.', ',') + '%';

const sortedUnits = Object.entries(trinksByUnit).sort((a, b) => b[1] - a[1]);
const topUnit = sortedUnits[0];
const weakUnit = sortedUnits[sortedUnits.length - 1];

const janRec = months[0] ? months[0].indicadores.receita_bruta : 0;
const maiRec = months[4] ? months[4].indicadores.receita_bruta : 0;
const quedaPct = janRec > 0 ? ((1 - maiRec / janRec) * 100).toFixed(0) : 0;

const unitLines = sortedUnits.map(([u, v]) =>
  `\u2022 ${u}: ${fmtK(v)} (${(v / totalTrinks * 100).toFixed(1)}%)`
).join('\n');

const monthEvolution = months.map((d) => {
  const r = d.indicadores.resultado_operacional;
  const label = d.mes.charAt(0).toUpperCase() + d.mes.slice(1);
  return `\u2022 ${label}: ${fmtK(r)} (${d.indicadores.margem_operacional.toFixed(1)}%)`;
}).join('\n');

const report = {
  secoes: {
    visao_geral: {
      title: 'Vis\u00e3o Geral \u2014 Acumulado 2026 (Jan-Jun)',
      analysis: `No primeiro semestre de 2026, o Grupo Bronze da GG acumulou receita bruta de ${fmtM(totalRec)}, com receita l\u00edquida de ${fmtM(recLiq)} ap\u00f3s dedu\u00e7\u00f5es de ${fmtK(totalDed)}. A margem bruta ficou em ${fmtPct(margemBruta)} e a margem operacional em ${fmtPct(margemOp)}, demonstrando ${margemOp > 20 ? 'solidez operacional' : margemOp > 0 ? 'opera\u00e7\u00e3o positiva mas com margem apertada' : 'resultado operacional negativo que demanda aten\u00e7\u00e3o'}.

\u2022 Faturamento Trinks (compet\u00eancia): ${fmtM(totalTrinks)} em 6 meses
\u2022 Unidade l\u00edder: ${topUnit ? topUnit[0] + ' com ' + fmtK(topUnit[1]) : 'N/A'}
\u2022 Custos diretos (CMV): ${fmtK(totalCustos)}
\u2022 Despesas G&A: ${fmtK(totalDna)}
\u2022 Resultado operacional acumulado: ${fmtK(resultadoOp)}`
    },
    receita: {
      title: 'An\u00e1lise de Receita',
      analysis: `A receita bruta acumulada no 1\u00ba semestre foi de ${fmtM(totalRec)}. O faturamento via Trinks totalizou ${fmtM(totalTrinks)}, representando a principal fonte de receita do grupo.

Por unidade Trinks:
${unitLines}

A tend\u00eancia mensal mostrou queda de receita de janeiro (m\u00eas mais forte com ${fmtK(janRec)}) at\u00e9 maio (${fmtK(maiRec)}), uma redu\u00e7\u00e3o de ${quedaPct}%. A sazonalidade do inverno impacta diretamente o servi\u00e7o de bronzeamento. Junho mostrou recupera\u00e7\u00e3o parcial.`
    },
    despesa: {
      title: 'An\u00e1lise de Despesas',
      analysis: `As despesas totais no semestre somaram ${fmtM(totalDesp)}. Os principais drivers de custo foram:

\u2022 Custos diretos (CMV/CSP): ${fmtK(totalCustos)} \u2014 dominados por compras de produtos LABOTERRA e fornecedores
\u2022 Custos de venda (maquininha/comiss\u00f5es): ${fmtK(totalCustosVenda)}
\u2022 Despesas com pessoal: ${fmtK(totalDespPessoal)}
\u2022 Despesas operacionais: ${fmtK(totalDespOp)}
\u2022 DNA/G&A (rateio): ${fmtK(totalDna)}

A estrutura de custos fixos (aluguel, pessoal G&A, pr\u00f3-labore, consultoria) pressiona a margem nos meses de menor faturamento.`
    },
    fluxo_caixa: {
      title: 'Resultado Operacional',
      analysis: `O resultado operacional acumulado do semestre foi de ${fmtK(resultadoOp)}, com margem operacional de ${fmtPct(margemOp)}. A margem bruta de ${fmtPct(margemBruta)} indica boa efici\u00eancia na opera\u00e7\u00e3o de bronze, mas as despesas G&A de ${fmtK(totalDna)} consomem parte significativa da margem.

Evolu\u00e7\u00e3o mensal do resultado:
${monthEvolution}`
    },
    tesouraria: {
      title: 'Alertas e Riscos',
      analysis: `\u26a0 Sazonalidade: o faturamento caiu de ${fmtK(janRec)} (janeiro) para ${fmtK(maiRec)} (maio), uma queda de ${quedaPct}%. O inverno impacta diretamente a demanda por bronze.

\u26a0 Concentra\u00e7\u00e3o: ${topUnit ? topUnit[0] + ' concentra ' + (topUnit[1] / totalTrinks * 100).toFixed(0) + '% do faturamento Trinks' : ''}. Depend\u00eancia alta de uma \u00fanica unidade.

\u26a0 Custos fixos: a estrutura de G&A (${fmtK(totalDna)} no semestre) \u00e9 pesada para meses de baixo faturamento, comprimindo margens.

\u26a0 ${weakUnit ? weakUnit[0] + ' \u00e9 a unidade com menor faturamento (' + fmtK(weakUnit[1]) + '). Avaliar estrat\u00e9gias de crescimento.' : ''}`
    },
    comparativo: {
      title: 'Recomenda\u00e7\u00f5es Estrat\u00e9gicas',
      analysis: `1. Combater sazonalidade: criar promo\u00e7\u00f5es e pacotes especiais para inverno (maio-agosto), incentivando manuten\u00e7\u00e3o do bronze mesmo no frio.

2. Diversificar receita: ampliar venda de produtos com kits home care e programas de fidelidade.

3. Otimizar G&A: revisar contratos de consultoria, marketing e assessoria para reduzir custos fixos em meses de baixa.

4. Expandir unidades menores: investir em marketing local e parcerias com influenciadoras nas unidades de menor faturamento.

5. Negociar CMV: renegociar com LABOTERRA (principal fornecedor) buscando desconto por volume.

6. Controlar descontos: segmentar cupons por tipo (aquisi\u00e7\u00e3o vs reten\u00e7\u00e3o) e medir ROI de cada campanha.`
    }
  },
  conclusao: `O primeiro semestre de 2026 do Grupo Bronze da GG registrou receita bruta acumulada de ${fmtM(totalRec)} com margem bruta de ${fmtPct(margemBruta)} e resultado operacional de ${fmtK(resultadoOp)}. A opera\u00e7\u00e3o se mostra saud\u00e1vel mas com press\u00e3o sazonal nos meses de inverno e estrutura de G&A que demanda aten\u00e7\u00e3o cont\u00ednua. O foco para o 2\u00ba semestre deve ser na reten\u00e7\u00e3o de clientes durante o inverno e na prepara\u00e7\u00e3o para a alta temporada de ver\u00e3o.`,
  indicadores: {
    receita_bruta: totalRec,
    receita_liquida: recLiq,
    lucro_bruto: lucroBruto,
    resultado_operacional: resultadoOp,
    margem_bruta: parseFloat(margemBruta.toFixed(1)),
    margem_operacional: parseFloat(margemOp.toFixed(1)),
    total_despesas: totalDesp,
    custos_diretos: totalCustos,
    custos_venda: totalCustosVenda,
    deducoes: totalDed,
    desp_pessoal: totalDespPessoal,
    desp_operacao: totalDespOp,
    total_dna: totalDna,
    trinks_total: totalTrinks,
    trinks_por_unidade: trinksByUnit
  }
};

fs.writeFileSync('report.json', JSON.stringify(report, null, 2));
console.log('OK: report.json (' + (fs.statSync('report.json').size / 1024).toFixed(1) + ' KB)');
