/**
 * pages-5.jsx — Paginas customizadas Bronze da GG
 * DRE segue a estrutura exata da Ferramenta Financeira (planilha)
 */

function _safeGet(obj, key, def) { try { return obj[key] || def; } catch(e) { return def; } }

// =========================================================================
// PAGE DRE — estrutura idêntica à planilha Ferramenta Financeira
// =========================================================================
const PageDRE = function(props) {
  var statusFilter = props.statusFilter || 'realizado';
  var drilldown = props.drilldown;
  var setDrilldown = props.setDrilldown || function(){};
  var year = props.year || 2026;
  var months = props.months || [];

  var B;
  try { B = window.getBit(statusFilter, drilldown, year, months); } catch(e) { B = window.BIT; }
  var fmt = (B && B.fmt) ? B.fmt : window.BIT.fmt;
  var fmtK = (B && B.fmtK) ? B.fmtK : window.BIT.fmtK;

  var catOverrides = {};
  try { catOverrides = window.BIT_META.categoria_overrides || {}; } catch(e) {}

  // --- unit filter state ---
  var unitState = useState('');
  var selectedUnit = unitState[0];
  var setSelectedUnit = unitState[1];
  var allUnits = useMemo(function() {
    var set = {};
    var tx = window.ALL_TX || [];
    for (var i = 0; i < tx.length; i++) { if (tx[i][8]) set[tx[i][8]] = true; }
    var trx = window.TRINKS_TX || [];
    for (var j = 0; j < trx.length; j++) { if (trx[j][8]) set[trx[j][8]] = true; }
    return Object.keys(set).sort();
  }, []);

  // Effective unit filter: from dropdown or drilldown
  var unitFilter = selectedUnit || ((drilldown && drilldown.type === 'unidade') ? drilldown.value : null);

  var dreData = useMemo(function() {
    try {
      var meta = window.BIT_META || {};
      var trinksUnits = meta.trinks_units || [];
      var dupCats = meta.trinks_dup_cats || ['1.1. Serviços de Bronze', '1.2. Produtos'];
      var y = String(year);
      var monthSet = null;
      if (months && months.length > 0) {
        monthSet = {};
        months.forEach(function(m) { monthSet[y + '-' + String(m).padStart(2, '0')] = true; });
      }
      function inPeriod(r) {
        if (!(r[1] && r[1].indexOf(y) === 0)) return false;
        if (monthSet && !monthSet[r[1]]) return false;
        if (unitFilter && r[8] !== unitFilter) return false;
        return true;
      }
      // inPeriod SEM filtro de unidade (para G&A consolidado)
      function inPeriodAll(r) {
        if (!(r[1] && r[1].indexOf(y) === 0)) return false;
        if (monthSet && !monthSet[r[1]]) return false;
        return true;
      }
      function isDup(categoria, unidade) {
        return dupCats.indexOf(categoria) >= 0 && trinksUnits.indexOf(unidade) >= 0;
      }

      // Grupos G&A que sofrem rateio proporcional ao faturamento
      var GA_GROUPS = {
        dna_pessoal: true, dna_admin: true, dna_marketing: true,
        dna_invest: true, nao_identificado: true,
        receita_fin: true, despesa_fin: true,
        distribuicao: true, financeiro: true
      };
      function isGA(catType) { return GA_GROUPS[catType] === true; }

      // ---- RATEIO: calcular % de faturamento da unidade sobre o total ----
      var gaRatio = 1; // 100% se consolidado
      var gaRatioByMonth = {}; // ratio por mês para DRE mensal
      if (unitFilter) {
        // Faturamento total (todas unidades) e da unidade filtrada
        var allTrinks = (window.TRINKS_TX || []);
        var fatTotal = 0, fatUnidade = 0;
        var fatTotalByMonth = {}, fatUnidadeByMonth = {};
        for (var ti = 0; ti < allTrinks.length; ti++) {
          var tr = allTrinks[ti];
          if (!(tr[1] && tr[1].indexOf(y) === 0)) continue;
          if (monthSet && !monthSet[tr[1]]) continue;
          fatTotal += tr[5];
          if (!fatTotalByMonth[tr[1]]) fatTotalByMonth[tr[1]] = 0;
          fatTotalByMonth[tr[1]] += tr[5];
          if (tr[8] === unitFilter) {
            fatUnidade += tr[5];
            if (!fatUnidadeByMonth[tr[1]]) fatUnidadeByMonth[tr[1]] = 0;
            fatUnidadeByMonth[tr[1]] += tr[5];
          }
        }
        // Incluir outras receitas CA no faturamento total e da unidade
        var allCA = (window.ALL_TX || []);
        for (var ci = 0; ci < allCA.length; ci++) {
          var cr = allCA[ci];
          if (cr[0] !== 'r') continue;
          if (!(cr[1] && cr[1].indexOf(y) === 0)) continue;
          if (monthSet && !monthSet[cr[1]]) continue;
          if (isDup(cr[3], cr[8])) continue;
          var crt = catOverrides[cr[3]];
          if (crt === 'receita' || crt === 'outra_receita') {
            fatTotal += cr[5];
            if (!fatTotalByMonth[cr[1]]) fatTotalByMonth[cr[1]] = 0;
            fatTotalByMonth[cr[1]] += cr[5];
            if (cr[8] === unitFilter) {
              fatUnidade += cr[5];
              if (!fatUnidadeByMonth[cr[1]]) fatUnidadeByMonth[cr[1]] = 0;
              fatUnidadeByMonth[cr[1]] += cr[5];
            }
          }
        }
        gaRatio = fatTotal > 0 ? fatUnidade / fatTotal : 0;
        // Ratio por mês
        for (var mk in fatTotalByMonth) {
          gaRatioByMonth[mk] = fatTotalByMonth[mk] > 0
            ? (fatUnidadeByMonth[mk] || 0) / fatTotalByMonth[mk] : 0;
        }
      }

      // Acumuladores por DRE group
      var groups = {
        faturamento: {}, deducao: {}, cmv: {}, custo_venda: {},
        desp_pessoal: {}, desp_operacao: {}, invest_unidade: {},
        dna_pessoal: {}, dna_admin: {}, dna_marketing: {}, dna_invest: {},
        nao_identificado: {}, receita_fin: {}, despesa_fin: {},
        distribuicao: {}, financeiro: {},
        outra_receita: {}
      };
      function addToGroup(grp, cat, val) {
        if (!groups[grp]) groups[grp] = {};
        groups[grp][cat] = (groups[grp][cat] || 0) + val;
      }
      function sumGroup(grp) {
        var total = 0;
        var g = groups[grp] || {};
        for (var k in g) total += g[k];
        return total;
      }

      // Monthly accumulators
      var byMonth = {};
      function ensureMonth(mes) {
        if (!byMonth[mes]) byMonth[mes] = {
          faturamento: 0, outra_receita: 0, deducao: 0,
          cmv: 0, custo_venda: 0,
          desp_pessoal: 0, desp_operacao: 0, invest_unidade: 0,
          dna_pessoal: 0, dna_admin: 0, dna_marketing: 0, dna_invest: 0,
          nao_identificado: 0, receita_fin: 0, despesa_fin: 0,
          distribuicao: 0, financeiro: 0
        };
        return byMonth[mes];
      }

      // Helper: classifica uma categoria e retorna o grupo DRE
      function classifyCat(kind, categoria) {
        var catType = catOverrides[categoria];
        if (!catType) return kind === 'r' ? 'outra_receita' : 'nao_identificado';
        if (catType === 'transferencia' || catType === 'outros') return null;
        if (kind === 'r' && catType === 'receita') return 'outra_receita';
        // Legacy mappings
        if (catType === 'despesa') return 'desp_operacao';
        if (catType === 'dna') return 'dna_admin';
        if (catType === 'imposto') return 'deducao';
        if (catType === 'investimento') return 'invest_unidade';
        return catType;
      }

      // ---- Conta Azul: itens da unidade (NÃO G&A) ----
      var caFiltered = (window.ALL_TX || []).filter(inPeriod);
      if (statusFilter === 'realizado') caFiltered = caFiltered.filter(function(r) { return r[6] === 1; });
      else if (statusFilter === 'a_pagar_receber') caFiltered = caFiltered.filter(function(r) { return r[6] === 0; });

      for (var i = 0; i < caFiltered.length; i++) {
        var row = caFiltered[i];
        var kind = row[0], mes = row[1], categoria = row[3], valor = row[5], unidade = row[8];
        if (kind === 'r' && isDup(categoria, unidade)) continue;
        var grp = classifyCat(kind, categoria);
        if (!grp) continue;
        // Itens G&A da unidade filtrada serão rateados abaixo — pular aqui
        if (unitFilter && isGA(grp)) continue;
        addToGroup(grp, categoria, valor);
        if (mes) ensureMonth(mes)[grp] += valor;
      }

      // ---- G&A: ler TODAS as unidades e aplicar rateio ----
      var caAll = (window.ALL_TX || []).filter(inPeriodAll);
      if (statusFilter === 'realizado') caAll = caAll.filter(function(r) { return r[6] === 1; });
      else if (statusFilter === 'a_pagar_receber') caAll = caAll.filter(function(r) { return r[6] === 0; });

      for (var gi = 0; gi < caAll.length; gi++) {
        var grow = caAll[gi];
        var gkind = grow[0], gmes = grow[1], gcategoria = grow[3], gvalor = grow[5];
        if (gkind === 'r' && isDup(gcategoria, grow[8])) continue;
        var ggrp = classifyCat(gkind, gcategoria);
        if (!ggrp || !isGA(ggrp)) continue;
        // Aplicar rateio proporcional
        var rateadoVal = gvalor * gaRatio;
        addToGroup(ggrp, gcategoria, rateadoVal);
        if (gmes) {
          var monthRatio = unitFilter ? (gaRatioByMonth[gmes] || gaRatio) : 1;
          ensureMonth(gmes)[ggrp] += gvalor * monthRatio;
        }
      }

      // ---- Trinks (competência): FATURAMENTO ----
      var fatBruto = 0;
      var trFiltered = (window.TRINKS_TX || []).filter(inPeriod);
      for (var j = 0; j < trFiltered.length; j++) {
        var tr = trFiltered[j];
        fatBruto += tr[5];
        addToGroup('faturamento', tr[3], tr[5]);
        if (tr[1]) ensureMonth(tr[1]).faturamento += tr[5];
      }

      // ---- Calcular totais da DRE ----
      var outrasReceitas = sumGroup('outra_receita');
      var totalFaturamento = fatBruto + outrasReceitas;
      var totalDeducoes = sumGroup('deducao');
      var receitaBruta = totalFaturamento;
      var receitaLiquida = receitaBruta - totalDeducoes;

      var totalCMV = sumGroup('cmv');
      var totalCustoVenda = sumGroup('custo_venda');
      var custosTotais = totalCMV + totalCustoVenda;
      var lucroBruto = receitaLiquida - custosTotais;

      var totalDespPessoal = sumGroup('desp_pessoal');
      var totalDespOperacao = sumGroup('desp_operacao');
      var totalInvestUnidade = sumGroup('invest_unidade');
      var despesasUnidades = totalDespPessoal + totalDespOperacao + totalInvestUnidade;
      var lucroUnidades = lucroBruto - despesasUnidades;

      var totalDnaPessoal = sumGroup('dna_pessoal');
      var totalDnaAdmin = sumGroup('dna_admin');
      var totalDnaMarketing = sumGroup('dna_marketing');
      var totalDnaInvest = sumGroup('dna_invest');
      var totalNaoIdentificado = sumGroup('nao_identificado');
      var despesasGA = totalDnaPessoal + totalDnaAdmin + totalDnaMarketing + totalDnaInvest + totalNaoIdentificado;
      var lucroOperacional = lucroUnidades - despesasGA;

      var totalReceitaFin = sumGroup('receita_fin');
      var totalDespesaFin = sumGroup('despesa_fin');
      var totalFinanceiro = sumGroup('financeiro');
      var lucroLiquido = lucroOperacional + totalReceitaFin - totalDespesaFin - totalFinanceiro;

      var totalDistribuicao = sumGroup('distribuicao');
      var resultadoExercicio = lucroLiquido - totalDistribuicao;

      // ---- DRE Lines (hierárquica como a planilha) ----
      var dreLines = [
        // FATURAMENTO
        { label: 'FATURAMENTO', value: totalFaturamento, bold: true, level: 0, hl: true, group: 'faturamento_all' },
        { label: '1.1. Serviços de Bronze', value: (groups.faturamento['1.1. Serviços de Bronze'] || 0), bold: false, level: 1, group: null, sub: true },
        { label: '1.2. Produtos', value: (groups.faturamento['1.2. Produtos'] || 0), bold: false, level: 1, group: null, sub: true },
        { label: '(+) Outras Receitas', value: outrasReceitas, bold: false, level: 1, group: 'outra_receita' },

        // RECEITA BRUTA = FATURAMENTO (já é a mesma coisa nesta estrutura)
        { label: 'RECEITA BRUTA', value: receitaBruta, bold: true, level: 0, hl: true },

        // DEDUÇÕES
        { label: '(-) DEDUÇÕES', value: totalDeducoes, bold: true, level: 0, neg: true, group: 'deducao' },

        // RECEITA LÍQUIDA
        { label: 'RECEITA LÍQUIDA', value: receitaLiquida, bold: true, level: 0, hl: true },

        // CUSTOS TOTAIS
        { label: '(-) CUSTOS TOTAIS', value: custosTotais, bold: true, level: 0, neg: true },
        { label: 'CMV', value: totalCMV, bold: false, level: 1, group: 'cmv' },
        { label: 'Custo de Venda', value: totalCustoVenda, bold: false, level: 1, group: 'custo_venda' },

        // LUCRO BRUTO
        { label: 'LUCRO BRUTO', value: lucroBruto, bold: true, level: 0, hl: true, res: true },

        // DESPESAS UNIDADES
        { label: '(-) DESPESAS UNIDADES', value: despesasUnidades, bold: true, level: 0, neg: true },
        { label: 'Despesas com Pessoal', value: totalDespPessoal, bold: false, level: 1, group: 'desp_pessoal' },
        { label: 'Despesas com Operação', value: totalDespOperacao, bold: false, level: 1, group: 'desp_operacao' },
        { label: 'Investimentos', value: totalInvestUnidade, bold: false, level: 1, group: 'invest_unidade' },

        // LUCRO UNIDADES
        { label: 'LUCRO UNIDADES', value: lucroUnidades, bold: true, level: 0, hl: true, res: true },

        // DESPESAS G&A
        { label: '(-) DESPESAS GERAL E ADMINISTRATIVAS', value: despesasGA, bold: true, level: 0, neg: true },
        { label: 'Despesas com Pessoal G&A', value: totalDnaPessoal, bold: false, level: 1, group: 'dna_pessoal' },
        { label: 'Despesas Administrativas', value: totalDnaAdmin, bold: false, level: 1, group: 'dna_admin' },
        { label: 'Despesas com Marketing', value: totalDnaMarketing, bold: false, level: 1, group: 'dna_marketing' },
        { label: 'Investimentos G&A', value: totalDnaInvest, bold: false, level: 1, group: 'dna_invest' },
        { label: 'Não Identificados', value: totalNaoIdentificado, bold: false, level: 1, group: 'nao_identificado' },

        // LUCRO OPERACIONAL
        { label: 'LUCRO OPERACIONAL', value: lucroOperacional, bold: true, level: 0, hl: true, res: true },

        // FINANCEIRO
        { label: '(+) Receita Financeira', value: totalReceitaFin, bold: false, level: 0, group: 'receita_fin' },
        { label: '(-) Despesa Financeira', value: totalDespesaFin, bold: false, level: 0, neg: true, group: 'despesa_fin' },
        { label: '(-) Financeiro (Empréstimos)', value: totalFinanceiro, bold: false, level: 0, neg: true, group: 'financeiro' },

        // LUCRO LÍQUIDO
        { label: 'LUCRO LÍQUIDO', value: lucroLiquido, bold: true, level: 0, hl: true, res: true },

        // DISTRIBUIÇÃO
        { label: '(-) Distribuição de Lucros', value: totalDistribuicao, bold: false, level: 0, neg: true, group: 'distribuicao' },

        // RESULTADO DO EXERCÍCIO
        { label: 'RESULTADO DO EXERCÍCIO', value: resultadoExercicio, bold: true, level: 0, hl: true, res: true },
      ];

      // Monthly DRE
      var monthKeys = Object.keys(byMonth).sort();
      var ML = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      var dreMonthly = monthKeys.map(function(m) {
        var d = byMonth[m];
        var fat = d.faturamento + d.outra_receita;
        var ded = d.deducao;
        var recLiq = fat - ded;
        var custos = d.cmv + d.custo_venda;
        var lb = recLiq - custos;
        var despU = d.desp_pessoal + d.desp_operacao + d.invest_unidade;
        var lu = lb - despU;
        var ga = d.dna_pessoal + d.dna_admin + d.dna_marketing + d.dna_invest + d.nao_identificado;
        var lop = lu - ga;
        var ll = lop + d.receita_fin - d.despesa_fin - d.financeiro;
        var re = ll - d.distribuicao;
        return {
          mes: m, label: ML[parseInt(m.slice(5,7),10)-1] || m,
          faturamento: fat, deducoes: ded, receitaLiq: recLiq,
          custos: custos, lucroBruto: lb,
          despUnidades: despU, lucroUnidades: lu,
          despGA: ga, lucroOp: lop,
          recFin: d.receita_fin, despFin: d.despesa_fin,
          lucroLiq: ll, distribuicao: d.distribuicao,
          resultado: re
        };
      });

      var margemBruta = receitaBruta > 0 ? (lucroBruto / receitaBruta * 100) : 0;
      var margemOp = receitaBruta > 0 ? (lucroOperacional / receitaBruta * 100) : 0;
      var margemLiq = receitaBruta > 0 ? (lucroLiquido / receitaBruta * 100) : 0;

      return {
        dreLines: dreLines, groups: groups, dreMonthly: dreMonthly,
        receitaBruta: receitaBruta, lucroBruto: lucroBruto,
        lucroOperacional: lucroOperacional, lucroLiquido: lucroLiquido,
        resultadoExercicio: resultadoExercicio,
        margemBruta: margemBruta, margemOp: margemOp, margemLiq: margemLiq,
        gaRatio: gaRatio
      };
    } catch(e) {
      console.error('DRE error:', e);
      return {
        dreLines: [], groups: {}, dreMonthly: [],
        receitaBruta: 0, lucroBruto: 0, lucroOperacional: 0,
        lucroLiquido: 0, resultadoExercicio: 0,
        margemBruta: 0, margemOp: 0, margemLiq: 0
      };
    }
  }, [statusFilter, drilldown, year, months, unitFilter]);

  var expandedState = useState({});
  var expanded = expandedState[0];
  var setExpanded = expandedState[1];
  function toggleGroup(grp) {
    var next = Object.assign({}, expanded);
    next[grp] = !next[grp];
    setExpanded(next);
  }

  var unitLabel = unitFilter || 'Consolidado';
  var rateioPct = unitFilter && dreData.gaRatio < 1
    ? " \u00b7 Rateio G&A: " + (dreData.gaRatio * 100).toFixed(1) + "%"
    : "";

  return React.createElement("div", { className: "page" },
    React.createElement("div", { className: "page-title" },
      React.createElement("div", null,
        React.createElement("h1", null, "DRE \u2014 Demonstra\u00e7\u00e3o de Resultado"),
        React.createElement("div", { className: "status-line" }, unitLabel + " \u00b7 " + year + rateioPct)
      )
    ),

    // Unit filter dropdown
    React.createElement("div", { style: { display: "flex", gap: 12, alignItems: "center", marginBottom: 16 } },
      React.createElement("label", { style: { fontSize: 13, color: "#c8b8a4", fontWeight: 600 } }, "Unidade:"),
      React.createElement("select", {
        value: selectedUnit,
        onChange: function(e) { setSelectedUnit(e.target.value); },
        style: {
          background: "#1a1410", color: "#f5efe8", border: "1px solid #382c20",
          borderRadius: 8, padding: "6px 12px", fontSize: 13,
          fontFamily: "var(--font-ui)", cursor: "pointer", minWidth: 180
        }
      },
        React.createElement("option", { value: "" }, "Todas (Consolidado)"),
        allUnits.map(function(u) {
          return React.createElement("option", { key: u, value: u }, u);
        })
      )
    ),

    React.createElement(DrilldownBadge, { drilldown: drilldown, onClear: function() { setDrilldown(null); } }),

    // KPIs
    React.createElement("div", { className: "row row-4" },
      React.createElement(KpiTile, { label: "Receita Bruta", value: fmtK(dreData.receitaBruta), tone: "cyan" }),
      React.createElement(KpiTile, { label: "Margem Bruta", value: dreData.margemBruta.toFixed(1) + "%", tone: dreData.margemBruta >= 0 ? "green" : "red" }),
      React.createElement(KpiTile, { label: "Margem Operac.", value: dreData.margemOp.toFixed(1) + "%", tone: dreData.margemOp >= 0 ? "green" : "red" }),
      React.createElement(KpiTile, { label: "Resultado", value: fmtK(dreData.resultadoExercicio), tone: dreData.resultadoExercicio >= 0 ? "green" : "red" })
    ),

    // DRE Table
    React.createElement("div", { className: "card", style: { padding: 24 } },
      React.createElement("h2", { className: "card-title" }, "Estrutura DRE"),
      React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 14, color: "#f5efe8" } },
        React.createElement("thead", null,
          React.createElement("tr", { style: { borderBottom: "2px solid #382c20" } },
            React.createElement("th", { style: { padding: "10px 12px", textAlign: "left", color: "#c8b8a4", fontSize: 12 } }, "Linha"),
            React.createElement("th", { style: { padding: "10px 12px", textAlign: "right", color: "#c8b8a4", fontSize: 12 } }, "Valor"),
            React.createElement("th", { style: { padding: "10px 12px", textAlign: "right", color: "#c8b8a4", fontSize: 12 } }, "% RB")
          )
        ),
        React.createElement("tbody", null,
          dreData.dreLines.map(function(line, i) {
            var grp = line.group;
            var hasDetail = grp && dreData.groups[grp] && Object.keys(dreData.groups[grp]).length > 0;
            var isOpen = grp && expanded[grp];

            // Color logic
            var lc = "#fff";
            if (line.res) lc = line.value >= 0 ? "#10b981" : "#ef4444";
            var displayVal = line.neg ? -line.value : line.value;
            var vc = displayVal < 0 ? "#ef4444" : lc;
            if (line.sub) { lc = "#c8b8a4"; vc = "#c8b8a4"; }

            var pct = dreData.receitaBruta > 0 ? (line.value / dreData.receitaBruta * 100).toFixed(1) + "%" : "\u2014";

            var rows = [];
            rows.push(
              React.createElement("tr", {
                key: "l" + i,
                style: {
                  borderBottom: line.hl ? "2px solid #382c20" : "1px solid #2a2018",
                  background: line.hl ? "#1a1410" : "transparent",
                  cursor: hasDetail ? "pointer" : "default"
                },
                onClick: hasDetail ? function() { toggleGroup(grp); } : undefined
              },
                React.createElement("td", {
                  style: { padding: "10px 12px", paddingLeft: line.level * 24 + 12, fontWeight: line.bold ? 700 : 400, color: lc, fontSize: line.sub ? 13 : 14 }
                },
                  hasDetail ? (isOpen ? "\u25BC " : "\u25B6 ") : (line.sub ? "  \u2022 " : ""),
                  line.label
                ),
                React.createElement("td", {
                  style: { padding: "10px 12px", textAlign: "right", fontWeight: line.bold ? 700 : 400, color: vc, fontFamily: "var(--font-mono, monospace)" }
                }, fmt(line.neg ? -line.value : line.value)),
                React.createElement("td", {
                  style: { padding: "10px 12px", textAlign: "right", color: "#8c7e6e", fontSize: 12 }
                }, pct)
              )
            );

            // Expanded detail rows
            if (isOpen && dreData.groups[grp]) {
              var entries = Object.entries(dreData.groups[grp]).sort(function(a,b) { return Math.abs(b[1]) - Math.abs(a[1]); });
              entries.forEach(function(entry) {
                var cat = entry[0], val = entry[1];
                var cpct = dreData.receitaBruta > 0 ? (val / dreData.receitaBruta * 100).toFixed(1) + "%" : "\u2014";
                rows.push(
                  React.createElement("tr", { key: "d-" + grp + "-" + cat, style: { borderBottom: "1px solid #2a2018", background: "#140f0a" } },
                    React.createElement("td", { style: { padding: "6px 12px", paddingLeft: 60, fontSize: 12, color: "#9e8e78" } }, cat),
                    React.createElement("td", { style: { padding: "6px 12px", textAlign: "right", fontSize: 12, color: val < 0 ? "#ef4444" : "#c8b8a4", fontFamily: "var(--font-mono, monospace)" } }, fmt(line.neg ? -val : val)),
                    React.createElement("td", { style: { padding: "6px 12px", textAlign: "right", fontSize: 11, color: "#8c7e6e" } }, cpct)
                  )
                );
              });
            }
            return rows;
          })
        )
      )
    ),

    // DRE Mensal
    dreData.dreMonthly.length > 0 ? React.createElement("div", { className: "card", style: { padding: 24, overflowX: "auto" } },
      React.createElement("h2", { className: "card-title" }, "DRE Mensal"),
      React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 900, color: "#f5efe8" } },
        React.createElement("thead", null,
          React.createElement("tr", { style: { borderBottom: "2px solid #382c20" } },
            React.createElement("th", { style: { padding: 8, textAlign: "left", color: "#c8b8a4", minWidth: 160 } }, "Linha"),
            dreData.dreMonthly.map(function(d) {
              return React.createElement("th", { key: d.mes, style: { padding: 8, textAlign: "right", minWidth: 75, color: "#c8b8a4" } }, d.label);
            }),
            React.createElement("th", { style: { padding: 8, textAlign: "right", fontWeight: 700, color: "#c8b8a4" } }, "Total")
          )
        ),
        React.createElement("tbody", null,
          [
            { key: "faturamento", label: "Faturamento", bold: true },
            { key: "deducoes", label: "(-) Dedu\u00e7\u00f5es", bold: false, neg: true },
            { key: "receitaLiq", label: "Receita L\u00edquida", bold: true },
            { key: "custos", label: "(-) Custos", bold: false, neg: true },
            { key: "lucroBruto", label: "Lucro Bruto", bold: true, res: true },
            { key: "despUnidades", label: "(-) Desp. Unidades", bold: false, neg: true },
            { key: "lucroUnidades", label: "Lucro Unidades", bold: true, res: true },
            { key: "despGA", label: "(-) Desp. G&A", bold: false, neg: true },
            { key: "lucroOp", label: "Lucro Operacional", bold: true, res: true },
            { key: "recFin", label: "(+) Rec. Financeira", bold: false },
            { key: "despFin", label: "(-) Desp. Financeira", bold: false, neg: true },
            { key: "lucroLiq", label: "Lucro L\u00edquido", bold: true, res: true },
            { key: "distribuicao", label: "(-) Distribui\u00e7\u00e3o", bold: false, neg: true },
            { key: "resultado", label: "Resultado", bold: true, res: true }
          ].map(function(line) {
            var total = dreData.dreMonthly.reduce(function(s,d) { return s + (d[line.key] || 0); }, 0);
            return React.createElement("tr", { key: line.key, style: { borderBottom: line.bold ? "2px solid #382c20" : "1px solid #2a2018" } },
              React.createElement("td", { style: { padding: 8, fontWeight: line.bold ? 700 : 400, color: line.res ? (total >= 0 ? "#10b981" : "#ef4444") : "#fff" } }, line.label),
              dreData.dreMonthly.map(function(d) {
                var v = d[line.key] || 0;
                var display = line.neg ? -v : v;
                var c = line.res ? (v >= 0 ? "#10b981" : "#ef4444") : "#fff";
                return React.createElement("td", { key: d.mes, style: { padding: 8, textAlign: "right", fontFamily: "var(--font-mono, monospace)", fontWeight: line.bold ? 700 : 400, color: c } }, fmtK(display));
              }),
              React.createElement("td", { style: { padding: 8, textAlign: "right", fontWeight: 700, fontFamily: "var(--font-mono, monospace)", color: line.res ? (total >= 0 ? "#10b981" : "#ef4444") : "#fff" } }, fmtK(line.neg ? -total : total))
            );
          })
        )
      )
    ) : null
  );
};


// =========================================================================
// PAGE FATURAMENTO TRINKS
// =========================================================================
const PageFaturamentoTrinks = function(props) {
  var statusFilter = props.statusFilter || 'realizado';
  var drilldown = props.drilldown;
  var setDrilldown = props.setDrilldown || function(){};
  var year = props.year || 2026;
  var months = props.months || [];

  var B;
  try { B = window.getBit(statusFilter, drilldown, year, months); } catch(e) { B = window.BIT; }
  var fmt = (B && B.fmt) ? B.fmt : window.BIT.fmt;
  var fmtK = (B && B.fmtK) ? B.fmtK : window.BIT.fmtK;

  var fatData = useMemo(function() {
    try {
      var ff = (window.TRINKS_TX || []);
      if (drilldown && drilldown.type === 'unidade') { var uv = drilldown.value; ff = ff.filter(function(r) { return r[8] === uv; }); }
      var y = String(year);
      ff = ff.filter(function(r) { return r[1] && r[1].indexOf(y) === 0; });
      if (months && months.length > 0) {
        var ms = {}; months.forEach(function(m) { ms[y + '-' + String(m).padStart(2,'0')] = true; });
        ff = ff.filter(function(r) { return ms[r[1]]; });
      }
      var byCat = {}, byUnit = {}, byMonth = {};
      for (var i = 0; i < ff.length; i++) {
        var r = ff[i];
        byCat[r[3]] = (byCat[r[3]] || 0) + r[5];
        var u = r[8] || 'Sem unidade';
        byUnit[u] = (byUnit[u] || 0) + r[5];
        if (!byMonth[r[1]]) byMonth[r[1]] = { servicos: 0, produtos: 0, outros: 0, total: 0 };
        if (r[3] === '1.1. Serviços de Bronze') byMonth[r[1]].servicos += r[5];
        else if (r[3].indexOf('1.2') === 0) byMonth[r[1]].produtos += r[5];
        else byMonth[r[1]].outros += r[5];
        byMonth[r[1]].total += r[5];
      }
      var totalFat = 0; Object.keys(byCat).forEach(function(k) { totalFat += byCat[k]; });
      return { byCat: byCat, byUnit: byUnit, byMonth: byMonth, totalFat: totalFat };
    } catch(e) {
      return { byCat: {}, byUnit: {}, byMonth: {}, totalFat: 0 };
    }
  }, [statusFilter, drilldown, year, months]);

  var catItems = Object.keys(fatData.byCat).map(function(k) { return { name: k, value: fatData.byCat[k] }; }).sort(function(a,b) { return b.value - a.value; });
  var unitItems = Object.keys(fatData.byUnit).map(function(k) { return { name: k, value: fatData.byUnit[k] }; }).sort(function(a,b) { return b.value - a.value; });
  var monthKeys = Object.keys(fatData.byMonth).sort();
  var ML = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  return React.createElement("div", { className: "page" },
    React.createElement("div", { className: "page-title" },
      React.createElement("div", null,
        React.createElement("h1", null, "Faturamento \u2014 Trinks"),
        React.createElement("div", { className: "status-line" }, ((drilldown && drilldown.type === 'unidade') ? drilldown.value : 'Todas unidades') + " \u00b7 " + year)
      )
    ),
    React.createElement(DrilldownBadge, { drilldown: drilldown, onClear: function() { setDrilldown(null); } }),
    React.createElement("div", { className: "row row-4" },
      React.createElement(KpiTile, { label: "Fat. Comercial", value: fmtK(fatData.totalFat), tone: "cyan" }),
      React.createElement(KpiTile, { label: "Unidades", value: String(Object.keys(fatData.byUnit).length), tone: "green" }),
      React.createElement(KpiTile, { label: "Categorias", value: String(Object.keys(fatData.byCat).length), tone: "amber" }),
      React.createElement(KpiTile, { label: "Meses", value: String(monthKeys.length), tone: "cyan" })
    ),
    React.createElement("div", { className: "row" },
      React.createElement("div", { className: "card", style: { flex: 1 } },
        React.createElement("h2", { className: "card-title" }, "Por Tipo de Receita"),
        React.createElement(BarList, { items: catItems, color: "green" })
      ),
      React.createElement("div", { className: "card", style: { flex: 1 } },
        React.createElement("h2", { className: "card-title" }, "Por Unidade"),
        React.createElement(BarList, { items: unitItems, color: "cyan" })
      )
    ),
    monthKeys.length > 0 ? React.createElement("div", { className: "card", style: { padding: 24, overflowX: "auto" } },
      React.createElement("h2", { className: "card-title" }, "Faturamento Mensal"),
      React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 13, color: "#f5efe8" } },
        React.createElement("thead", null,
          React.createElement("tr", { style: { borderBottom: "2px solid #382c20" } },
            React.createElement("th", { style: { padding: 8, textAlign: "left", color: "#c8b8a4" } }, "M\u00eas"),
            React.createElement("th", { style: { padding: 8, textAlign: "right", color: "#c8b8a4" } }, "Servi\u00e7os"),
            React.createElement("th", { style: { padding: 8, textAlign: "right", color: "#c8b8a4" } }, "Produtos"),
            React.createElement("th", { style: { padding: 8, textAlign: "right", color: "#c8b8a4" } }, "Outros"),
            React.createElement("th", { style: { padding: 8, textAlign: "right", fontWeight: 700, color: "#c8b8a4" } }, "Total")
          )
        ),
        React.createElement("tbody", null,
          monthKeys.map(function(m) {
            var d = fatData.byMonth[m];
            var mi = parseInt(m.slice(5,7),10) - 1;
            return React.createElement("tr", { key: m, style: { borderBottom: "1px solid #2a2018" } },
              React.createElement("td", { style: { padding: 8 } }, ML[mi] + "/" + m.slice(0,4)),
              React.createElement("td", { style: { padding: 8, textAlign: "right", fontFamily: "var(--font-mono)" } }, fmtK(d.servicos)),
              React.createElement("td", { style: { padding: 8, textAlign: "right", fontFamily: "var(--font-mono)" } }, fmtK(d.produtos)),
              React.createElement("td", { style: { padding: 8, textAlign: "right", fontFamily: "var(--font-mono)" } }, fmtK(d.outros)),
              React.createElement("td", { style: { padding: 8, textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700 } }, fmtK(d.total))
            );
          })
        )
      )
    ) : null
  );
};


// =========================================================================
// PAGE LOJAS
// =========================================================================
const PageLojas = function(props) {
  var statusFilter = props.statusFilter || 'realizado';
  var drilldown = props.drilldown;
  var setDrilldown = props.setDrilldown || function(){};
  var year = props.year || 2026;
  var months = props.months || [];

  var B;
  try { B = window.getBit(statusFilter, null, year, months); } catch(e) { B = window.BIT; }
  var fmtK = (B && B.fmtK) ? B.fmtK : window.BIT.fmtK;

  var catOverrides = {};
  try { catOverrides = window.BIT_META.categoria_overrides || {}; } catch(e) {}

  var unitsData = useMemo(function() {
    try {
      var allTx = window.ALL_TX || [];
      var filtered = allTx;
      if (statusFilter === 'realizado') filtered = filtered.filter(function(r) { return r[6] === 1; });
      else if (statusFilter === 'a_pagar_receber') filtered = filtered.filter(function(r) { return r[6] === 0; });
      var y = String(year);
      filtered = filtered.filter(function(r) { return r[1] && r[1].indexOf(y) === 0; });
      if (months && months.length > 0) {
        var ms = {}; months.forEach(function(m) { ms[y + '-' + String(m).padStart(2,'0')] = true; });
        filtered = filtered.filter(function(r) { return ms[r[1]]; });
      }
      var units = {};
      var grupoU = ['Matriz','Franquias','Itaim','Menino Deus','GG House','Capão'];
      for (var i = 0; i < filtered.length; i++) {
        var r = filtered[i];
        var u = r[8] || 'Sem unidade';
        var ct = catOverrides[r[3]] || (r[0] === 'r' ? 'receita' : 'despesa');
        if (ct === 'transferencia') continue;
        if (!units[u]) units[u] = { receita: 0, despesa: 0, dna: 0 };
        if (r[0] === 'r') units[u].receita += r[5];
        else {
          units[u].despesa += r[5];
          if (ct === 'dna' || ct === 'dna_pessoal' || ct === 'dna_admin' || ct === 'dna_marketing' || ct === 'dna_invest') units[u].dna += r[5];
        }
      }
      var result = Object.keys(units).map(function(name) {
        var d = units[name];
        return { name: name, receita: d.receita, despesa: d.despesa, resultado: d.receita - d.despesa, margem: d.receita > 0 ? ((d.receita - d.despesa) / d.receita * 100) : 0, dna: d.dna, isGrupo: grupoU.indexOf(name) >= 0 };
      }).sort(function(a,b) { return b.receita - a.receita; });
      var tg = { receita: 0, despesa: 0 };
      result.forEach(function(r) { if (r.isGrupo) { tg.receita += r.receita; tg.despesa += r.despesa; } });
      return { units: result, totalGrupo: tg };
    } catch(e) {
      return { units: [], totalGrupo: { receita: 0, despesa: 0 } };
    }
  }, [statusFilter, year, months]);

  return React.createElement("div", { className: "page" },
    React.createElement("div", { className: "page-title" },
      React.createElement("div", null,
        React.createElement("h1", null, "Unidades \u2014 Ranking"),
        React.createElement("div", { className: "status-line" }, "Comparativo entre unidades \u00b7 " + year)
      )
    ),
    React.createElement("div", { className: "row row-4" },
      React.createElement(KpiTile, { label: "Receita Grupo", value: fmtK(unitsData.totalGrupo.receita), tone: "green" }),
      React.createElement(KpiTile, { label: "Despesa Grupo", value: fmtK(unitsData.totalGrupo.despesa), tone: "red" }),
      React.createElement(KpiTile, { label: "Resultado", value: fmtK(unitsData.totalGrupo.receita - unitsData.totalGrupo.despesa), tone: (unitsData.totalGrupo.receita - unitsData.totalGrupo.despesa) >= 0 ? "green" : "red" }),
      React.createElement(KpiTile, { label: "Unidades", value: String(unitsData.units.length), tone: "cyan" })
    ),
    React.createElement("div", { className: "card", style: { padding: 24 } },
      React.createElement("h2", { className: "card-title" }, "Resultado por Unidade"),
      React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 13, color: "#f5efe8" } },
        React.createElement("thead", null,
          React.createElement("tr", { style: { borderBottom: "2px solid #382c20" } },
            React.createElement("th", { style: { padding: 10, textAlign: "left", color: "#c8b8a4" } }, "Unidade"),
            React.createElement("th", { style: { padding: 10, textAlign: "center", color: "#c8b8a4", fontSize: 11 } }, "Grupo"),
            React.createElement("th", { style: { padding: 10, textAlign: "right", color: "#c8b8a4" } }, "Receita"),
            React.createElement("th", { style: { padding: 10, textAlign: "right", color: "#c8b8a4" } }, "Despesa"),
            React.createElement("th", { style: { padding: 10, textAlign: "right", color: "#c8b8a4" } }, "DNA"),
            React.createElement("th", { style: { padding: 10, textAlign: "right", color: "#c8b8a4" } }, "Resultado"),
            React.createElement("th", { style: { padding: 10, textAlign: "right", color: "#c8b8a4" } }, "Margem")
          )
        ),
        React.createElement("tbody", null,
          unitsData.units.map(function(u) {
            return React.createElement("tr", { key: u.name, style: { borderBottom: "1px solid #2a2018", cursor: "pointer" }, onClick: function() { setDrilldown({ type: "unidade", value: u.name, label: u.name }); } },
              React.createElement("td", { style: { padding: 10, fontWeight: 600, color: "#f5efe8" } }, u.name),
              React.createElement("td", { style: { padding: 10, textAlign: "center", color: "#c8b8a4" } }, u.isGrupo ? "\u2713" : "\u2014"),
              React.createElement("td", { style: { padding: 10, textAlign: "right", fontFamily: "var(--font-mono)", color: "#10b981" } }, fmtK(u.receita)),
              React.createElement("td", { style: { padding: 10, textAlign: "right", fontFamily: "var(--font-mono)", color: "#ef4444" } }, fmtK(u.despesa)),
              React.createElement("td", { style: { padding: 10, textAlign: "right", fontFamily: "var(--font-mono)", color: "#f59e0b" } }, fmtK(u.dna)),
              React.createElement("td", { style: { padding: 10, textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700, color: u.resultado >= 0 ? "#10b981" : "#ef4444" } }, fmtK(u.resultado)),
              React.createElement("td", { style: { padding: 10, textAlign: "right", color: u.margem >= 0 ? "#10b981" : "#ef4444" } }, u.margem.toFixed(1) + "%")
            );
          })
        )
      )
    ),
    React.createElement("div", { className: "row" },
      React.createElement("div", { className: "card", style: { flex: 1 } },
        React.createElement("h2", { className: "card-title" }, "Receita por Unidade"),
        React.createElement(BarList, { items: unitsData.units.map(function(u) { return { name: u.name, value: u.receita }; }), color: "green" })
      ),
      React.createElement("div", { className: "card", style: { flex: 1 } },
        React.createElement("h2", { className: "card-title" }, "Resultado por Unidade"),
        React.createElement(BarList, { items: unitsData.units.map(function(u) { return { name: u.name, value: u.resultado }; }).filter(function(u) { return u.value !== 0; }), color: "cyan" })
      )
    )
  );
};

Object.assign(window, { PageDRE: PageDRE, PageFaturamentoTrinks: PageFaturamentoTrinks, PageLojas: PageLojas });
