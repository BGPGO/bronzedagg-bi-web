/**
 * pages-5.jsx — Paginas customizadas Bronze da GG
 */

// Helper seguro
function _safeGet(obj, key, def) { try { return obj[key] || def; } catch(e) { return def; } }

// =========================================================================
// PAGE DRE
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

  var dreData = useMemo(function() {
    try {
      var allTx = window.ALL_TX || [];
      var filtered = allTx;

      if (statusFilter === 'realizado') filtered = filtered.filter(function(r) { return r[6] === 1; });
      else if (statusFilter === 'a_pagar_receber') filtered = filtered.filter(function(r) { return r[6] === 0; });

      if (drilldown && drilldown.type === 'unidade') {
        var uVal = drilldown.value;
        filtered = filtered.filter(function(r) { return r[8] === uVal; });
      }

      var y = String(year);
      filtered = filtered.filter(function(r) { return r[1] && r[1].indexOf(y) === 0; });

      if (months && months.length > 0) {
        var monthSet = {};
        months.forEach(function(m) { monthSet[y + '-' + String(m).padStart(2, '0')] = true; });
        filtered = filtered.filter(function(r) { return monthSet[r[1]]; });
      }

      var byType = { receita: 0, deducao: 0, imposto: 0, custo: 0, despesa: 0, dna: 0, investimento: 0, financeiro: 0 };
      var catDetail = {};
      var byMonth = {};

      for (var i = 0; i < filtered.length; i++) {
        var row = filtered[i];
        var kind = row[0], mes = row[1], categoria = row[3], valor = row[5];
        var catType = catOverrides[categoria] || (kind === 'r' ? 'receita' : 'despesa');
        if (catType === 'transferencia' || catType === 'outros') continue;

        if (byType[catType] !== undefined) byType[catType] += valor;

        if (!catDetail[catType]) catDetail[catType] = {};
        catDetail[catType][categoria] = (catDetail[catType][categoria] || 0) + valor;

        if (mes) {
          if (!byMonth[mes]) byMonth[mes] = { receita: 0, deducao: 0, imposto: 0, custo: 0, despesa: 0, dna: 0, investimento: 0, financeiro: 0 };
          if (byMonth[mes][catType] !== undefined) byMonth[mes][catType] += valor;
        }
      }

      var fatBruto = byType.receita;
      var deducoes = byType.deducao + byType.imposto;
      var receitaLiq = fatBruto - deducoes;
      var custos = byType.custo;
      var lucroBruto = receitaLiq - custos;
      var despOp = byType.despesa;
      var lucroPre = lucroBruto - despOp;
      var dna = byType.dna;
      var resultadoUnidade = lucroPre - dna;
      var investimentos = byType.investimento;
      var financeiro = byType.financeiro;
      var resultadoFinal = resultadoUnidade - investimentos - financeiro;

      var margemBruta = fatBruto > 0 ? (lucroBruto / fatBruto * 100) : 0;
      var margemOp = fatBruto > 0 ? (lucroPre / fatBruto * 100) : 0;

      var dreLines = [
        { label: 'FATURAMENTO COMERCIAL', value: fatBruto, bold: true, level: 0, type: null },
        { label: '(-) Descontos / Deduções', value: -byType.deducao, bold: false, level: 1, type: 'deducao' },
        { label: '(-) Impostos', value: -byType.imposto, bold: false, level: 1, type: 'imposto' },
        { label: '= RECEITA LÍQUIDA', value: receitaLiq, bold: true, level: 0, type: null, hl: true },
        { label: '(-) Custos (CSP/CMV)', value: -custos, bold: false, level: 1, type: 'custo' },
        { label: '= LUCRO BRUTO', value: lucroBruto, bold: true, level: 0, type: null, hl: true },
        { label: '(-) Despesas Operacionais', value: -despOp, bold: false, level: 1, type: 'despesa' },
        { label: '= RESULTADO PRÉ-DNA', value: lucroPre, bold: true, level: 0, type: null, hl: true },
        { label: '(-) Rateio DNA / G&A', value: -dna, bold: false, level: 1, type: 'dna' },
        { label: '= RESULTADO DA UNIDADE', value: resultadoUnidade, bold: true, level: 0, type: null, hl: true, res: true },
        { label: '(-) Investimentos (CAPEX)', value: -investimentos, bold: false, level: 1, type: 'investimento' },
        { label: '(-) Financeiro', value: -financeiro, bold: false, level: 1, type: 'financeiro' },
        { label: '= RESULTADO FINAL', value: resultadoFinal, bold: true, level: 0, type: null, hl: true, res: true },
      ];

      var monthKeys = Object.keys(byMonth).sort();
      var ML = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      var dreMonthly = monthKeys.map(function(m) {
        var d = byMonth[m];
        var rec = d.receita, ded = d.deducao + d.imposto, cst = d.custo, dsp = d.despesa, dn = d.dna;
        return { mes: m, label: ML[parseInt(m.slice(5,7),10)-1] || m, receita: rec, deducoes: ded, receitaLiq: rec-ded, custos: cst, lucroBruto: rec-ded-cst, despesas: dsp, lucroPre: rec-ded-cst-dsp, dna: dn, resultado: rec-ded-cst-dsp-dn };
      });

      return { dreLines: dreLines, catDetail: catDetail, dreMonthly: dreMonthly, fatBruto: fatBruto, margemBruta: margemBruta, margemOp: margemOp, resultadoFinal: resultadoFinal };
    } catch(e) {
      return { dreLines: [], catDetail: {}, dreMonthly: [], fatBruto: 0, margemBruta: 0, margemOp: 0, resultadoFinal: 0 };
    }
  }, [statusFilter, drilldown, year, months]);

  var expandedType = useState(null);
  var expanded = expandedType[0];
  var setExpanded = expandedType[1];

  var unitLabel = (drilldown && drilldown.type === 'unidade') ? drilldown.value : 'Consolidado';

  return React.createElement("div", { className: "page" },
    React.createElement("div", { className: "page-title" },
      React.createElement("div", null,
        React.createElement("h1", null, "DRE \u2014 Demonstra\u00e7\u00e3o de Resultado"),
        React.createElement("div", { className: "status-line" }, unitLabel + " \u00b7 " + year)
      )
    ),
    React.createElement(DrilldownBadge, { drilldown: drilldown, onClear: function() { setDrilldown(null); } }),

    // KPIs
    React.createElement("div", { className: "row row-4" },
      React.createElement(KpiTile, { label: "Faturamento", value: fmtK(dreData.fatBruto), tone: "cyan" }),
      React.createElement(KpiTile, { label: "Margem Bruta", value: dreData.margemBruta.toFixed(1) + "%", tone: dreData.margemBruta >= 0 ? "green" : "red" }),
      React.createElement(KpiTile, { label: "Margem Operac.", value: dreData.margemOp.toFixed(1) + "%", tone: dreData.margemOp >= 0 ? "green" : "red" }),
      React.createElement(KpiTile, { label: "Resultado Final", value: fmtK(dreData.resultadoFinal), tone: dreData.resultadoFinal >= 0 ? "green" : "red" })
    ),

    // DRE Table
    React.createElement("div", { className: "card", style: { padding: 24 } },
      React.createElement("h2", { className: "card-title" }, "Estrutura DRE"),
      React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 14, color: "#fff" } },
        React.createElement("tbody", null,
          dreData.dreLines.map(function(line, i) {
            var isExp = line.type && dreData.catDetail[line.type] && Object.keys(dreData.catDetail[line.type]).length > 0;
            var isOpen = expanded === line.type;
            var lc = line.res ? (line.value >= 0 ? "#10b981" : "#ef4444") : "#fff";
            var vc = line.value < 0 ? "#ef4444" : lc;
            var pct = dreData.fatBruto > 0 ? (line.value / dreData.fatBruto * 100).toFixed(1) + "%" : "\u2014";
            var rows = [];
            rows.push(
              React.createElement("tr", {
                key: "l" + i,
                style: { borderBottom: line.hl ? "2px solid #243038" : "1px solid #1a242a", background: line.hl ? "#11181d" : "transparent", cursor: isExp ? "pointer" : "default" },
                onClick: isExp ? function() { setExpanded(isOpen ? null : line.type); } : undefined
              },
                React.createElement("td", { style: { padding: "10px 12px", paddingLeft: line.level * 24 + 12, fontWeight: line.bold ? 700 : 400, color: lc } },
                  isExp ? (isOpen ? "\u25BC " : "\u25B6 ") : "",
                  line.label
                ),
                React.createElement("td", { style: { padding: "10px 12px", textAlign: "right", fontWeight: line.bold ? 700 : 400, color: vc, fontFamily: "var(--font-mono, monospace)" } }, fmt(line.value)),
                React.createElement("td", { style: { padding: "10px 12px", textAlign: "right", color: "#b8c2c8", fontSize: 12 } }, pct)
              )
            );
            if (isOpen && dreData.catDetail[line.type]) {
              var entries = Object.entries(dreData.catDetail[line.type]).sort(function(a,b) { return b[1] - a[1]; });
              entries.forEach(function(entry) {
                var cat = entry[0], val = entry[1];
                var cpct = dreData.fatBruto > 0 ? (val / dreData.fatBruto * 100).toFixed(1) + "%" : "\u2014";
                rows.push(
                  React.createElement("tr", { key: "d" + cat, style: { borderBottom: "1px solid #1a242a", background: "#0d1216" } },
                    React.createElement("td", { style: { padding: "6px 12px", paddingLeft: 60, fontSize: 13, color: "#b8c2c8" } }, cat),
                    React.createElement("td", { style: { padding: "6px 12px", textAlign: "right", fontSize: 13, color: "#fff", fontFamily: "var(--font-mono, monospace)" } }, fmt(val)),
                    React.createElement("td", { style: { padding: "6px 12px", textAlign: "right", fontSize: 11, color: "#b8c2c8" } }, cpct)
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
      React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 800, color: "#fff" } },
        React.createElement("thead", null,
          React.createElement("tr", { style: { borderBottom: "2px solid #243038" } },
            React.createElement("th", { style: { padding: 8, textAlign: "left", color: "#b8c2c8" } }, "Linha"),
            dreData.dreMonthly.map(function(d) {
              return React.createElement("th", { key: d.mes, style: { padding: 8, textAlign: "right", minWidth: 75, color: "#b8c2c8" } }, d.label);
            }),
            React.createElement("th", { style: { padding: 8, textAlign: "right", fontWeight: 700, color: "#b8c2c8" } }, "Total")
          )
        ),
        React.createElement("tbody", null,
          [
            { key: "receita", label: "Faturamento", bold: true },
            { key: "deducoes", label: "(-) Dedu\u00e7\u00f5es", bold: false },
            { key: "receitaLiq", label: "Receita L\u00edquida", bold: true },
            { key: "custos", label: "(-) Custos", bold: false },
            { key: "lucroBruto", label: "Lucro Bruto", bold: true },
            { key: "despesas", label: "(-) Despesas Op.", bold: false },
            { key: "lucroPre", label: "Resultado Pr\u00e9-DNA", bold: true },
            { key: "dna", label: "(-) DNA/G&A", bold: false },
            { key: "resultado", label: "Resultado", bold: true }
          ].map(function(line) {
            var total = dreData.dreMonthly.reduce(function(s,d) { return s + (d[line.key] || 0); }, 0);
            var isNeg = line.key.indexOf("(") === 0 || line.key === "deducoes" || line.key === "custos" || line.key === "despesas" || line.key === "dna";
            return React.createElement("tr", { key: line.key, style: { borderBottom: line.bold ? "2px solid #243038" : "1px solid #1a242a" } },
              React.createElement("td", { style: { padding: 8, fontWeight: line.bold ? 700 : 400, color: "#fff" } }, line.label),
              dreData.dreMonthly.map(function(d) {
                var v = d[line.key] || 0;
                var c = line.key === "resultado" ? (v >= 0 ? "#10b981" : "#ef4444") : "#fff";
                return React.createElement("td", { key: d.mes, style: { padding: 8, textAlign: "right", fontFamily: "var(--font-mono, monospace)", fontWeight: line.bold ? 700 : 400, color: c } }, fmtK(isNeg ? -v : v));
              }),
              React.createElement("td", { style: { padding: 8, textAlign: "right", fontWeight: 700, fontFamily: "var(--font-mono, monospace)", color: line.key === "resultado" ? (total >= 0 ? "#10b981" : "#ef4444") : "#fff" } }, fmtK(isNeg ? -total : total))
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
      var allTx = window.ALL_TX || [];
      var filtered = allTx.filter(function(r) { return r[0] === 'r'; });
      if (statusFilter === 'realizado') filtered = filtered.filter(function(r) { return r[6] === 1; });
      else if (statusFilter === 'a_pagar_receber') filtered = filtered.filter(function(r) { return r[6] === 0; });
      if (drilldown && drilldown.type === 'unidade') { var uv = drilldown.value; filtered = filtered.filter(function(r) { return r[8] === uv; }); }
      var y = String(year);
      filtered = filtered.filter(function(r) { return r[1] && r[1].indexOf(y) === 0; });
      if (months && months.length > 0) {
        var ms = {}; months.forEach(function(m) { ms[y + '-' + String(m).padStart(2,'0')] = true; });
        filtered = filtered.filter(function(r) { return ms[r[1]]; });
      }
      var fatCats = ['1.1. Serviços de Bronze','1.2. Produtos','1.2.1. Produtos Franquias','1.3. Sublocação','1.5. Taxa Representação','1.6. Royalties Franquia','1.7. Taxa de Marketing','1.9. Café','1.10. Vendas TikTok','1.11. Taxa de Franquia'];
      var ff = filtered.filter(function(r) { return fatCats.indexOf(r[3]) >= 0; });
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
      React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 13, color: "#fff" } },
        React.createElement("thead", null,
          React.createElement("tr", { style: { borderBottom: "2px solid #243038" } },
            React.createElement("th", { style: { padding: 8, textAlign: "left", color: "#b8c2c8" } }, "M\u00eas"),
            React.createElement("th", { style: { padding: 8, textAlign: "right", color: "#b8c2c8" } }, "Servi\u00e7os"),
            React.createElement("th", { style: { padding: 8, textAlign: "right", color: "#b8c2c8" } }, "Produtos"),
            React.createElement("th", { style: { padding: 8, textAlign: "right", color: "#b8c2c8" } }, "Outros"),
            React.createElement("th", { style: { padding: 8, textAlign: "right", fontWeight: 700, color: "#b8c2c8" } }, "Total")
          )
        ),
        React.createElement("tbody", null,
          monthKeys.map(function(m) {
            var d = fatData.byMonth[m];
            var mi = parseInt(m.slice(5,7),10) - 1;
            return React.createElement("tr", { key: m, style: { borderBottom: "1px solid #1a242a" } },
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
        else { units[u].despesa += r[5]; if (ct === 'dna') units[u].dna += r[5]; }
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
      React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 13, color: "#fff" } },
        React.createElement("thead", null,
          React.createElement("tr", { style: { borderBottom: "2px solid #243038" } },
            React.createElement("th", { style: { padding: 10, textAlign: "left", color: "#b8c2c8" } }, "Unidade"),
            React.createElement("th", { style: { padding: 10, textAlign: "center", color: "#b8c2c8", fontSize: 11 } }, "Grupo"),
            React.createElement("th", { style: { padding: 10, textAlign: "right", color: "#b8c2c8" } }, "Receita"),
            React.createElement("th", { style: { padding: 10, textAlign: "right", color: "#b8c2c8" } }, "Despesa"),
            React.createElement("th", { style: { padding: 10, textAlign: "right", color: "#b8c2c8" } }, "DNA"),
            React.createElement("th", { style: { padding: 10, textAlign: "right", color: "#b8c2c8" } }, "Resultado"),
            React.createElement("th", { style: { padding: 10, textAlign: "right", color: "#b8c2c8" } }, "Margem")
          )
        ),
        React.createElement("tbody", null,
          unitsData.units.map(function(u) {
            return React.createElement("tr", { key: u.name, style: { borderBottom: "1px solid #1a242a", cursor: "pointer" }, onClick: function() { setDrilldown({ type: "unidade", value: u.name, label: u.name }); } },
              React.createElement("td", { style: { padding: 10, fontWeight: 600, color: "#fff" } }, u.name),
              React.createElement("td", { style: { padding: 10, textAlign: "center", color: "#b8c2c8" } }, u.isGrupo ? "\u2713" : "\u2014"),
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
