/* BIT/BGP Finance — Pages 2: Fluxo, Tesouraria, Comparativo */
const { useState, useMemo, useEffect } = React;

// useIsMobile é declarado em pages-1.jsx e disponibilizado globalmente no bundle
// concatenado (build-jsx.cjs). Reutilizado aqui pra ajustar height/showLabels dos
// TrendCharts em mobile.

const PageFluxo = ({ filters, setFilters, onOpenFilters, statusFilter, drilldown, setDrilldown, year, months }) => {
  const B = useMemo(() => window.getBit(statusFilter, drilldown, year, months), [statusFilter, drilldown, year, months]);
  const isMobile = useIsMobile();
  const kpiFmt = useKpiFormat('fluxo');
  const fmtKpi = (n) => {
    const { value, unit } = kpiFmt.fmtVal(n);
    return `R$ ${value}${unit ? ` ${unit}` : ''}`;
  };
  const [view, setView] = useState("horizontal");
  const [range, setRange] = useState("12M");
  const [showOrcado, setShowOrcado] = useState(false);
  const [expandedRows, setExpandedRows] = useState(() => new Set());
  const toggleRow = (key) => setExpandedRows(s => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const months6 = B.MONTHS_FULL.slice(0, 6);
  const refYear = (B.META && B.META.ref_year) || new Date().getFullYear();
  const budget = window.BUDGET_BY_MONTH || {};

  // Para um mês (idx 0-5) retorna se ele deve usar orçado (sem realizado E showOrcado ativo)
  const isOrcadoMonth = (i) => {
    if (!showOrcado) return false;
    const recAtual = B.FLUXO_RECEITA.reduce((s, r) => s + (r.values[i] || 0), 0);
    const despAtual = B.FLUXO_DESPESA.reduce((s, r) => s + (r.values[i] || 0), 0);
    return Math.abs(recAtual) < 1 && Math.abs(despAtual) < 1; // mes vazio de realizado
  };
  // Pega o valor orçado de receita ou despesa pro mês i
  const getOrcadoVal = (kind, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const b = budget[`${refYear}-${mm}`];
    return b ? (kind === "r" ? b.receita : b.despesa) : 0;
  };

  // Retorna Top N lançamentos individuais da categoria nos 6 primeiros meses do ano corrente.
  const getCatLancamentos = (kind, cat, limit = 15) => {
    const allTx = window.ALL_TX || [];
    const filterTxFn = window.filterTx;
    const sf = statusFilter || window.BIT_FILTER || "realizado";
    const txFiltered = filterTxFn ? filterTxFn(allTx, sf, null) : allTx;
    const out = [];
    for (const row of txFiltered) {
      if (row[0] !== kind || row[3] !== cat) continue;
      const mes = row[1];
      if (!mes || !mes.startsWith(String(refYear))) continue;
      const mIdx = parseInt(mes.slice(5, 7), 10) - 1;
      if (mIdx < 0 || mIdx >= 6) continue; // só primeiros 6 meses (mesmo range da tabela)
      out.push({ mes, dia: row[2], parte: kind === "r" ? (row[4] || "—") : (row[7] || "—"), valor: row[5], mIdx });
    }
    return out.sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor)).slice(0, limit);
  };
  const handleMonthHeader = (i) => {
    const mm = String(i + 1).padStart(2, "0");
    const ym = `${refYear}-${mm}`;
    const mn = B.MONTHS_FULL[i] || "";
    setDrilldown({ type: "mes", value: ym, label: `${mn.charAt(0).toUpperCase() + mn.slice(1, 3)}/${refYear}` });
  };
  const activeMonthIdx = (drilldown && drilldown.type === "mes")
    ? parseInt(drilldown.value.slice(5, 7), 10) - 1 : -1;

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Fluxo de Caixa</h1>
          <div className="status-line">Análise horizontal/vertical e saldos por mês</div>
        </div>
        <div className="actions">
        </div>
      </div>

      <DrilldownBadge drilldown={drilldown} onClear={() => setDrilldown(null)} />
      <StatusEmptyHint statusFilter={statusFilter} bit={B} />

      <div className="metric-strip kpi-clickable-container" onClick={kpiFmt.toggle} title={kpiFmt.tooltipHint} style={{ cursor: "pointer", userSelect: "none" }}>
        <span className="kpi-toggle-hint" aria-hidden="true">{kpiFmt.expandIcon}</span>
        <div className="metric">
          <div className="m-label">Receita total</div>
          <div className="m-value">{fmtKpi(B.TOTAL_RECEITA)}</div>
          <div className="m-pct">100%</div>
          <div className="m-bar"><div style={{ width: `100%` }} /></div>
        </div>
        <div className="metric">
          <div className="m-label">Despesa total</div>
          <div className="m-value">{fmtKpi(B.TOTAL_DESPESA)}</div>
          <div className="m-pct">{B.TOTAL_RECEITA > 0 ? `${((B.TOTAL_DESPESA / B.TOTAL_RECEITA) * 100).toFixed(2).replace(".",",")}%` : "—"}</div>
          <div className="m-bar red"><div style={{ width: `${B.TOTAL_RECEITA > 0 ? Math.min(100, (B.TOTAL_DESPESA / B.TOTAL_RECEITA) * 100) : 0}%` }} /></div>
        </div>
        <div className="metric">
          <div className="m-label">Valor líquido</div>
          <div className="m-value" style={{ color: B.VALOR_LIQUIDO >= 0 ? "var(--green)" : "var(--red)" }}>{fmtKpi(B.VALOR_LIQUIDO)}</div>
          <div className="m-pct">{B.MARGEM_LIQUIDA.toFixed(2).replace(".",",")}%</div>
          <div className="m-bar cyan"><div style={{ width: `${Math.min(100, Math.max(0, B.MARGEM_LIQUIDA))}%` }} /></div>
        </div>
        <div className="metric">
          <div className="m-label">Margem líquida</div>
          <div className="m-value">{B.MARGEM_LIQUIDA.toFixed(2).replace(".",",")}%</div>
          <div className="m-pct">média do período</div>
          <div className="m-bar"><div style={{ width: `${Math.min(100, Math.max(0, B.MARGEM_LIQUIDA))}%` }} /></div>
        </div>
      </div>

      <div className="row" style={{ gridTemplateColumns: "minmax(220px, 1fr) minmax(0, 4fr)" }}>
        <div className="card">
          <h2 className="card-title">Valor líquido por mês</h2>
          <DivergingBars values={B.VALOR_LIQ_SERIES} labels={B.MONTHS.map(m => m.charAt(0).toUpperCase() + m.slice(1))} />
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Fluxo de caixa</h2>
            <div className="seg">
              <button className={view === "horizontal" ? "active" : ""} onClick={() => setView("horizontal")}>Análise horizontal</button>
              <button className={view === "vertical" ? "active" : ""} onClick={() => setView("vertical")}>Análise vertical</button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
            <div className="status-line" style={{ fontSize: 11, margin: 0 }}>
              {view === "vertical"
                ? "Vertical: todas as linhas (receita e despesa) como % da receita do mês"
                : "Horizontal: cada mês como % do total anual da linha"}
            </div>
            {/* Toggle só aparece se cliente tem orcamentos cadastrados no fin40 (BUDGET_BY_MONTH populado). */}
            {Object.keys(budget).length > 0 && (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--fg-2)', cursor: 'pointer', padding: '4px 10px', border: '1px solid ' + (showOrcado ? 'var(--cyan)' : 'var(--border)'), borderRadius: 6, background: showOrcado ? 'rgba(34, 211, 238, 0.08)' : 'transparent' }}>
                <input type="checkbox" checked={showOrcado} onChange={e => setShowOrcado(e.target.checked)} style={{ accentColor: 'var(--cyan)' }} />
                Incluir orçado nos meses futuros
              </label>
            )}
          </div>
          <div className="t-scroll" style={{ maxHeight: 320 }}>
            <table className="t">
              <thead>
                <tr>
                  <th style={{ minWidth: 200 }}>Receita / Despesa</th>
                  {months6.map((m, i) => {
                    const isActive = i === activeMonthIdx;
                    const isOrcado = isOrcadoMonth(i);
                    return (
                      <React.Fragment key={m}>
                        <th className={`num clickable-th ${isActive ? "active" : ""}`}
                            onClick={() => handleMonthHeader(i)}
                            style={{ cursor: "pointer", background: isOrcado ? "rgba(34, 211, 238, 0.08)" : undefined }}
                            title={isOrcado ? "Mês projetado (orçado)" : "Clique para filtrar este mês"}>
                          {m}
                          {isOrcado && <div style={{ fontSize: 9, color: "var(--cyan)", fontWeight: 700, letterSpacing: "0.1em", marginTop: 2 }}>ORÇADO</div>}
                        </th>
                        <th className="num">{view === "horizontal" ? "Δ%" : "%"}</th>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {/* Pre-calcula totais usados nas duas análises */}
                {(() => null)()}
                <tr className="section">
                  <td>Receita</td>
                  {months6.map((_, i) => {
                    // Total REAL = receita do mês (todas as categorias, batendo o KPI do header).
                    // FLUXO_RECEITA tem só top 5 categorias; resto entra em "Outras receitas" abaixo.
                    const realTotal = (B.MONTH_DATA && B.MONTH_DATA[i] ? B.MONTH_DATA[i].receita : 0)
                      || B.FLUXO_RECEITA.reduce((s, r) => s + (r.values[i] || 0), 0);
                    const isOrcado = isOrcadoMonth(i);
                    const total = isOrcado ? getOrcadoVal("r", i) : realTotal;
                    let pctLabel = "100%";
                    let pctColor = "var(--fg-3)";
                    if (view === "horizontal") {
                      const totalAno = B.FLUXO_RECEITA.reduce((s, r) => s + r.values.reduce((a, b) => a + (b || 0), 0), 0);
                      pctLabel = totalAno ? ((total / totalAno) * 100).toFixed(1).replace(".", ",") + "%" : "—";
                    } else {
                      pctLabel = "100%";
                    }
                    const bg = isOrcado ? "rgba(34, 211, 238, 0.06)" : undefined;
                    return (
                      <React.Fragment key={i}>
                        <td className="num green" style={{ background: bg, fontStyle: isOrcado ? "italic" : undefined }}>{B.fmt(total)}</td>
                        <td className="num" style={{ color: pctColor, fontWeight: view === "horizontal" ? 600 : 400, background: bg }}>{pctLabel}</td>
                      </React.Fragment>
                    );
                  })}
                </tr>
                {B.FLUXO_RECEITA.map(row => {
                  const catKey = `r:${row.cat}`;
                  const isOpen = expandedRows.has(catKey);
                  return (
                    <React.Fragment key={row.cat}>
                      <tr>
                        <td>
                          <button onClick={() => toggleRow(catKey)} style={{ background: "transparent", border: 0, color: "inherit", padding: 0, fontFamily: "inherit", fontSize: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }} title="Expandir lançamentos">
                            <span className="chev">{isOpen ? "−" : "+"}</span>{row.cat}
                          </button>
                        </td>
                        {months6.map((_, i) => {
                          const v = row.values[i] || 0;
                          let pctLabel = "0,00%";
                          let pctColor = "var(--fg-3)";
                          if (view === "vertical") {
                            const totalReceitaMes = B.FLUXO_RECEITA.reduce((s, r) => s + (r.values[i] || 0), 0);
                            const pct = totalReceitaMes ? (v / totalReceitaMes) * 100 : 0;
                            pctLabel = pct.toFixed(2).replace(".", ",") + "%";
                          } else {
                            const totalAnoLinha = row.values.reduce((s, x) => s + (x || 0), 0);
                            pctLabel = totalAnoLinha ? ((v / totalAnoLinha) * 100).toFixed(1).replace(".", ",") + "%" : "—";
                          }
                          return (
                            <React.Fragment key={i}>
                              <td className="num green">{B.fmt(v)}</td>
                              <td className="num" style={{ color: pctColor }}>{pctLabel}</td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                      {isOpen && getCatLancamentos("r", row.cat).map((t, j) => (
                        <tr key={`r${row.cat}_${j}`} style={{ background: "var(--surface-2)" }}>
                          <td style={{ paddingLeft: 28, fontSize: 12, color: "var(--fg-2)" }}>
                            <span style={{ color: "var(--mute)", marginRight: 8 }}>{String(t.dia).padStart(2, "0")}/{t.mes.slice(5, 7)}</span>
                            {t.parte}
                          </td>
                          {months6.map((_, i) => (
                            <React.Fragment key={i}>
                              <td className="num green" style={{ fontSize: 12 }}>{i === t.mIdx ? B.fmt(t.valor) : ""}</td>
                              <td className="num" style={{ fontSize: 12 }}></td>
                            </React.Fragment>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
                {/* Linha "Outras receitas" — captura delta entre total do mês e soma das top 5 categorias */}
                {(() => {
                  const hasOutros = months6.some((_, i) => {
                    const tot = (B.MONTH_DATA && B.MONTH_DATA[i] ? B.MONTH_DATA[i].receita : 0);
                    const top5 = B.FLUXO_RECEITA.reduce((s, r) => s + (r.values[i] || 0), 0);
                    return Math.abs(tot - top5) > 0.5;
                  });
                  if (!hasOutros) return null;
                  return (
                    <tr key="outras-r">
                      <td style={{ color: "var(--fg-2)" }}>Outras receitas</td>
                      {months6.map((_, i) => {
                        const tot = (B.MONTH_DATA && B.MONTH_DATA[i] ? B.MONTH_DATA[i].receita : 0);
                        const top5 = B.FLUXO_RECEITA.reduce((s, r) => s + (r.values[i] || 0), 0);
                        const v = tot - top5;
                        return (
                          <React.Fragment key={i}>
                            <td className="num green" style={{ color: "var(--fg-2)" }}>{Math.abs(v) > 0.5 ? B.fmt(v) : "—"}</td>
                            <td className="num">—</td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })()}
                <tr className="section">
                  <td>Despesa</td>
                  {months6.map((_, i) => {
                    // Total REAL despesa do mês (todas as categorias, batendo o KPI do header).
                    const realTotalD = (B.MONTH_DATA && B.MONTH_DATA[i] ? B.MONTH_DATA[i].despesa : 0)
                      || B.FLUXO_DESPESA.reduce((s, r) => s + (r.values[i] || 0), 0);
                    const isOrcadoD = isOrcadoMonth(i);
                    const totalDespesa = isOrcadoD ? getOrcadoVal("d", i) : realTotalD;
                    let pctLabel = "—";
                    let pctColor = "var(--fg-3)";
                    if (view === "vertical") {
                      // Despesa total do mês como % da receita do mês
                      const totalReceitaMes = B.FLUXO_RECEITA.reduce((s, r) => s + (r.values[i] || 0), 0);
                      pctLabel = totalReceitaMes ? ((totalDespesa / totalReceitaMes) * 100).toFixed(2).replace(".", ",") + "%" : "—";
                      pctColor = totalDespesa > totalReceitaMes ? "var(--red)" : "var(--fg-3)";
                    } else {
                      // Horizontal: % do total anual da seção Despesa
                      const totalAnoDesp = B.FLUXO_DESPESA.reduce((s, r) => s + r.values.reduce((a, b) => a + (b || 0), 0), 0);
                      pctLabel = totalAnoDesp ? ((totalDespesa / totalAnoDesp) * 100).toFixed(1).replace(".", ",") + "%" : "—";
                    }
                    const bgD = isOrcadoD ? "rgba(34, 211, 238, 0.06)" : undefined;
                    return (
                      <React.Fragment key={i}>
                        <td className="num red" style={{ background: bgD, fontStyle: isOrcadoD ? "italic" : undefined }}>{B.fmt(totalDespesa)}</td>
                        <td className="num" style={{ color: pctColor, fontWeight: view === "horizontal" ? 600 : 400, background: bgD }}>{pctLabel}</td>
                      </React.Fragment>
                    );
                  })}
                </tr>
                {B.FLUXO_DESPESA.map(row => {
                  const catKey = `d:${row.cat}`;
                  const isOpen = expandedRows.has(catKey);
                  return (<>
                    <tr key={row.cat}>
                      <td>
                        <button onClick={() => toggleRow(catKey)} style={{ background: "transparent", border: 0, color: "inherit", padding: 0, fontFamily: "inherit", fontSize: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }} title="Expandir lançamentos">
                          <span className="chev">{isOpen ? "−" : "+"}</span>{row.cat}
                        </button>
                      </td>
                      {months6.map((_, i) => {
                      const v = row.values[i] || 0;
                      let pctLabel = "0,00%";
                      let pctColor = "var(--fg-3)";
                      if (view === "vertical") {
                        // Despesa categoria como % da RECEITA do mês (não da despesa)
                        const totalReceitaMes = B.FLUXO_RECEITA.reduce((s, r) => s + (r.values[i] || 0), 0);
                        const pct = totalReceitaMes ? (v / totalReceitaMes) * 100 : 0;
                        pctLabel = pct.toFixed(2).replace(".", ",") + "%";
                      } else {
                        // Horizontal: % do total anual desta linha de despesa
                        const totalAnoLinha = row.values.reduce((s, x) => s + (x || 0), 0);
                        pctLabel = totalAnoLinha ? ((v / totalAnoLinha) * 100).toFixed(1).replace(".", ",") + "%" : "—";
                      }
                      return (
                        <React.Fragment key={i}>
                          <td className="num red">{B.fmt(v)}</td>
                          <td className="num" style={{ color: pctColor }}>{pctLabel}</td>
                        </React.Fragment>
                      );
                    })}
                    </tr>
                    {isOpen && getCatLancamentos("d", row.cat).map((t, j) => (
                      <tr key={`d${row.cat}_${j}`} style={{ background: "var(--surface-2)" }}>
                        <td style={{ paddingLeft: 28, fontSize: 12, color: "var(--fg-2)" }}>
                          <span style={{ color: "var(--mute)", marginRight: 8 }}>{String(t.dia).padStart(2, "0")}/{t.mes.slice(5, 7)}</span>
                          {t.parte}
                        </td>
                        {months6.map((_, i) => (
                          <React.Fragment key={i}>
                            <td className="num red" style={{ fontSize: 12 }}>{i === t.mIdx ? B.fmt(t.valor) : ""}</td>
                            <td className="num" style={{ fontSize: 12 }}></td>
                          </React.Fragment>
                        ))}
                      </tr>
                    ))}
                  </>);
                })}
                {/* Linha "Outras despesas" — delta entre total despesa do mês e soma das top 5 */}
                {(() => {
                  const hasOutros = months6.some((_, i) => {
                    const tot = (B.MONTH_DATA && B.MONTH_DATA[i] ? B.MONTH_DATA[i].despesa : 0);
                    const top5 = B.FLUXO_DESPESA.reduce((s, r) => s + (r.values[i] || 0), 0);
                    return Math.abs(tot - top5) > 0.5;
                  });
                  if (!hasOutros) return null;
                  return (
                    <tr key="outras-d">
                      <td style={{ color: "var(--fg-2)" }}>Outras despesas</td>
                      {months6.map((_, i) => {
                        const tot = (B.MONTH_DATA && B.MONTH_DATA[i] ? B.MONTH_DATA[i].despesa : 0);
                        const top5 = B.FLUXO_DESPESA.reduce((s, r) => s + (r.values[i] || 0), 0);
                        const v = tot - top5;
                        return (
                          <React.Fragment key={i}>
                            <td className="num red" style={{ color: "var(--fg-2)" }}>{Math.abs(v) > 0.5 ? B.fmt(v) : "—"}</td>
                            <td className="num">—</td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })()}
                <tr className="total">
                  <td>Total Líquido</td>
                  {months6.map((_, i) => {
                    const isOrcadoL = isOrcadoMonth(i);
                    // usa total do mês (MONTH_DATA) pra bater com KPI do header.
                    const r = isOrcadoL ? getOrcadoVal("r", i) : ((B.MONTH_DATA && B.MONTH_DATA[i] ? B.MONTH_DATA[i].receita : 0) || B.FLUXO_RECEITA.reduce((s, r) => s + (r.values[i] || 0), 0));
                    const d = isOrcadoL ? getOrcadoVal("d", i) : ((B.MONTH_DATA && B.MONTH_DATA[i] ? B.MONTH_DATA[i].despesa : 0) || B.FLUXO_DESPESA.reduce((s, r) => s + (r.values[i] || 0), 0));
                    const liq = r - d;
                    let pctLabel = "—";
                    let pctColor = liq >= 0 ? "var(--green)" : "var(--red)";
                    if (view === "vertical") {
                      // Margem líquida: liq / receita do mês
                      pctLabel = r ? ((liq / r) * 100).toFixed(2).replace(".", ",") + "%" : "—";
                    } else {
                      // Horizontal: cada mês como % do total liquido anual
                      const liqAno = B.FLUXO_RECEITA.reduce((s, rr) => s + rr.values.reduce((a, b) => a + (b || 0), 0), 0)
                                   - B.FLUXO_DESPESA.reduce((s, rr) => s + rr.values.reduce((a, b) => a + (b || 0), 0), 0);
                      pctLabel = liqAno ? ((liq / liqAno) * 100).toFixed(1).replace(".", ",") + "%" : "—";
                    }
                    const bgL = isOrcadoL ? "rgba(34, 211, 238, 0.06)" : undefined;
                    return (
                      <React.Fragment key={i}>
                        <td className="num" style={{ color: liq >= 0 ? "var(--green)" : "var(--red)", background: bgL, fontStyle: isOrcadoL ? "italic" : undefined }}>{B.fmt(liq)}</td>
                        <td className="num" style={{ color: pctColor, fontWeight: 600, background: bgL }}>{pctLabel}</td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Saldos acumulados por mês</h2>
        <TrendChart
          values={B.SALDOS_MES}
          labels={B.MONTHS.map(m => m.charAt(0).toUpperCase() + m.slice(1) + " " + String((B.META && B.META.ref_year) || "").slice(-2))}
          color="var(--cyan)"
          height={isMobile ? 200 : 300}
          showLabels={!isMobile}
          gradientId="fl-saldos"
        />
      </div>
    </div>
  );
};

const PageTesouraria = ({ filters, setFilters, onOpenFilters, statusFilter, drilldown, setDrilldown, year, months }) => {
  const B = useMemo(() => window.getBit(statusFilter, drilldown, year, months), [statusFilter, drilldown, year, months]);
  const isMobile = useIsMobile();
  const SEG = window.BIT_SEGMENTS || {};
  const kpiFmt = useKpiFormat('tesouraria');
  const fv = kpiFmt.fmtVal;

  // Estado do dia selecionado no pulso (lifted up pra filtrar KPIs)
  const [selectedDay, setSelectedDay] = useState(null);

  // Dados diários do ano inteiro (pra pulso e pra KPIs filtrados)
  const dailyData = useMemo(() => {
    const allTx = window.ALL_TX || [];
    const y = (B.META && B.META.ref_year) || new Date().getFullYear();
    const recTxReal = allTx.filter(r => r[0] === 'r' && r[6] === 1);
    const despTxReal = allTx.filter(r => r[0] === 'd' && r[6] === 1);
    const recByDay = new Map(), despByDay = new Map();
    for (const r of recTxReal) {
      const key = `${r[1]}-${String(r[2]).padStart(2, '0')}`;
      recByDay.set(key, (recByDay.get(key) || 0) + r[5]);
    }
    for (const r of despTxReal) {
      const key = `${r[1]}-${String(r[2]).padStart(2, '0')}`;
      despByDay.set(key, (despByDay.get(key) || 0) + r[5]);
    }
    const diasDoAno = [];
    for (let d = new Date(y, 0, 1); d <= new Date(y, 11, 31); d.setDate(d.getDate() + 1)) {
      const dt = new Date(d);
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const key = `${y}-${mm}-${dd}`;
      diasDoAno.push({
        date: dt, key, label: `${dd}/${mm}`,
        rec: recByDay.get(key) || 0,
        desp: despByDay.get(key) || 0,
      });
    }
    return { diasDoAno, allTx, y };
  }, [B.META]);

  // KPIs: se um dia está selecionado, filtra pra aquele dia
  const kpis = useMemo(() => {
    if (!selectedDay) {
      return {
        recebido: (SEG.realizado && SEG.realizado.KPIS && SEG.realizado.KPIS.TOTAL_RECEITA) || 0,
        aReceber: (SEG.a_pagar_receber && SEG.a_pagar_receber.KPIS && SEG.a_pagar_receber.KPIS.TOTAL_RECEITA) || 0,
        pago: (SEG.realizado && SEG.realizado.KPIS && SEG.realizado.KPIS.TOTAL_DESPESA) || 0,
        aPagar: (SEG.a_pagar_receber && SEG.a_pagar_receber.KPIS && SEG.a_pagar_receber.KPIS.TOTAL_DESPESA) || 0,
      };
    }
    const allTx = dailyData.allTx;
    let recReal = 0, despReal = 0, recPend = 0, despPend = 0;
    for (const r of allTx) {
      const key = `${r[1]}-${String(r[2]).padStart(2, '0')}`;
      if (key !== selectedDay) continue;
      if (r[0] === 'r') {
        if (r[6] === 1) recReal += r[5]; else recPend += r[5];
      } else {
        if (r[6] === 1) despReal += r[5]; else despPend += r[5];
      }
    }
    return { recebido: recReal, aReceber: recPend, pago: despReal, aPagar: despPend };
  }, [selectedDay, SEG, dailyData]);

  const { recebido, aReceber, pago, aPagar } = kpis;

  // Detalhe do dia selecionado
  const dayDetail = useMemo(() => {
    if (!selectedDay) return [];
    return dailyData.allTx.filter(r => {
      if (r[6] !== 1) return false;
      const key = `${r[1]}-${String(r[2]).padStart(2, '0')}`;
      return key === selectedDay;
    }).map(r => ({
      tipo: r[0] === 'r' ? 'Receita' : 'Despesa',
      categoria: r[3],
      nome: r[0] === 'r' ? r[4] : (r[7] || r[4]),
      valor: r[0] === 'r' ? r[5] : -r[5],
    })).sort((a, b) => b.valor - a.valor);
  }, [selectedDay, dailyData]);

  const selectedLabel = selectedDay ? selectedDay.slice(8, 10) + '/' + selectedDay.slice(5, 7) + '/' + selectedDay.slice(0, 4) : '';

  const recDiaSeg = (SEG.realizado && SEG.realizado.RECEITA_DIA) || B.RECEITA_DIA;
  const pagoDiaSeg = (SEG.realizado && SEG.realizado.DESPESA_DIA) || B.DESPESA_DIA;
  const aReceberDiaSeg = (SEG.a_pagar_receber && SEG.a_pagar_receber.RECEITA_DIA) || B.RECEITA_DIA;
  const aPagarDiaSeg = (SEG.a_pagar_receber && SEG.a_pagar_receber.DESPESA_DIA) || B.DESPESA_DIA;

  const saldosMes = (SEG.tudo && SEG.tudo.SALDOS_MES) || B.SALDOS_MES;
  // Cumulativo (running balance): cada mês = saldo atual após acumular movimentos
  const SALDOS_REAIS = (window.BIT_EXTRAS && window.BIT_EXTRAS.saldos) || null;
  // Saldo inicial do ano: usa o saldo real mais antigo da planilha (se disponível) menos os movimentos até o mês desse saldo.
  // Sem isso, parte de 0 e mostra apenas o efeito dos movimentos.
  const saldoInicial = (function() {
    if (!SALDOS_REAIS || !SALDOS_REAIS.last) return 0;
    const lastDate = new Date(SALDOS_REAIS.last.data);
    const lastMonthIdx = lastDate.getMonth();
    // Saldo no mês N = saldoInicial + sum(saldosMes[0..N]). Sabemos saldo atual e queremos saldo inicial.
    // saldoInicial = saldoAtual - sum(saldosMes[0..lastMonthIdx])
    let acumAteAgora = 0;
    for (let i = 0; i <= lastMonthIdx; i++) acumAteAgora += saldosMes[i] || 0;
    return SALDOS_REAIS.last.total - acumAteAgora;
  })();
  const saldosCum = saldosMes.reduce((acc, v, i) => {
    acc.push((acc[i - 1] != null ? acc[i - 1] : saldoInicial) + (v || 0));
    return acc;
  }, []);
  const sMax = Math.max(...saldosCum, 0);
  const sMin = Math.min(...saldosCum, 0);
  const sMed = saldosCum.length ? saldosCum.reduce((s, v) => s + v, 0) / saldosCum.length : 0;

  // Fluxo a vencer: pega o segmento a_pagar_receber (que tem só items NÃO realizados)
  // e filtra por data >= hoje. Ordem ascendente (próximo vencimento primeiro).
  const todayKey = (function() {
    const t = new Date();
    return t.getFullYear() * 10000 + (t.getMonth() + 1) * 100 + t.getDate();
  })();
  const parseFluxoDate = (s) => {
    const [d, m, y] = (s || '').split('/').map(Number);
    if (!d || !m || !y) return 0;
    return y * 10000 + m * 100 + d;
  };
  const saldoBaseInicial = (SALDOS_REAIS && SALDOS_REAIS.last && SALDOS_REAIS.last.total) || 0;
  const fluxoFuturoFull = useMemo(() => {
    // Lê direto de ALL_TX (não usa SEG.EXTRATO porque buildExtrato faz slice(0,200)
    // sortado DESC, perdendo lançamentos de 2026 quando há parcelas até 2033).
    const allTx = window.ALL_TX || [];
    // Filtra: não realizado (a-vencer) E data >= hoje
    // ALL_TX schema: [kind, mes (yyyy-mm), dia, categoria, cliente, valor, realizado, fornecedor, cc]
    const apr = allTx.filter(r => r[6] === 0);
    // Constrói tupla compatível com EXTRATO: [data DD/MM/YYYY, cc, categoria, cliente/fornec, valorAssinado, status]
    const rows = apr.map(r => {
      const [kind, mes, dia, categoria, cliente, valor, _realizado, fornecedor, cc] = r;
      if (!mes || !dia) return null;
      const dataStr = String(dia).padStart(2, '0') + '/' + mes.slice(5, 7) + '/' + mes.slice(0, 4);
      const valorAssinado = kind === 'r' ? valor : -valor;
      return [dataStr, cc || 'Operações', categoria, kind === 'r' ? cliente : fornecedor, valorAssinado, ''];
    }).filter(Boolean);
    // Aplica drilldown se houver
    const filtered = window.applyDrilldown ? window.applyDrilldown(rows, drilldown) : rows;
    // Filtra futuro + sort ASC (mais próximas primeiro)
    const sorted = filtered
      .filter(e => parseFluxoDate(e[0]) >= todayKey)
      .sort((a, b) => parseFluxoDate(a[0]) - parseFluxoDate(b[0]));
    // Saldo running
    let saldoRunning = saldoBaseInicial;
    return sorted.map((e) => {
      saldoRunning += (e[4] || 0);
      return [...e, saldoRunning];
    });
  }, [drilldown, todayKey, saldoBaseInicial]);

  // Tabela limita a 60 linhas, mas análise de risco usa o full
  const fluxoFuturo = useMemo(() => fluxoFuturoFull.slice(0, 60), [fluxoFuturoFull]);

  // Análise de risco de caixa: quando o saldo cai abaixo de zero pela 1ª vez?
  // Mínimo projetado e em qual data?
  const riscoAnalise = useMemo(() => {
    if (fluxoFuturoFull.length === 0) return null;
    let primeiroNegativo = null;
    let minSaldo = saldoBaseInicial;
    let minSaldoData = null;
    let saldoFinal = saldoBaseInicial;
    for (const row of fluxoFuturoFull) {
      const saldo = row[6];
      if (saldo < 0 && primeiroNegativo == null) {
        primeiroNegativo = { data: row[0], saldo, valor: row[4], movimento: row[3] || row[2] };
      }
      if (saldo < minSaldo) {
        minSaldo = saldo;
        minSaldoData = row[0];
      }
      saldoFinal = saldo;
    }
    // Dias até primeiro negativo
    let diasAteCrise = null;
    if (primeiroNegativo) {
      const [d, m, y] = primeiroNegativo.data.split('/').map(Number);
      const t = new Date(); t.setHours(0,0,0,0);
      const target = new Date(y, m - 1, d);
      diasAteCrise = Math.round((target - t) / (1000 * 60 * 60 * 24));
    }
    return { primeiroNegativo, minSaldo, minSaldoData, saldoFinal, diasAteCrise, totalLancamentos: fluxoFuturoFull.length };
  }, [fluxoFuturoFull, saldoBaseInicial]);

  // Saldo dia-a-dia agregado (pra chart de projeção). Agrupa lançamentos do mesmo dia.
  const saldoDiario = useMemo(() => {
    if (fluxoFuturoFull.length === 0) return [];
    const byDay = new Map();
    for (const row of fluxoFuturoFull) {
      const dataKey = row[0]; // DD/MM/YYYY
      // Para o chart, queremos o saldo NO FIM do dia
      byDay.set(dataKey, row[6]);
    }
    return [...byDay.entries()].map(([data, saldo]) => ({ data, saldo }));
  }, [fluxoFuturoFull]);

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Tesouraria</h1>
          <div className="status-line"><span className="live-dot" /> Saldos e pulso · {(B.META && B.META.ref_year) || "—"}</div>
        </div>
        <div className="actions">
        </div>
      </div>

      <DrilldownBadge drilldown={drilldown} onClear={() => setDrilldown(null)} />

      <div className="row row-4">
        <KpiTile label={selectedDay ? `Recebido (${selectedLabel})` : "Recebido (PAGO)"} value={fv(recebido).value} unit={fv(recebido).unit} sparkValues={recDiaSeg} sparkColor="var(--green)" tone="green" onClick={kpiFmt.toggle} title={kpiFmt.tooltipHint} expanded={kpiFmt.detailed} />
        <KpiTile label={selectedDay ? `A receber (${selectedLabel})` : "A receber"} value={fv(aReceber).value} unit={fv(aReceber).unit} sparkValues={aReceberDiaSeg} sparkColor="var(--cyan)" tone="cyan" onClick={kpiFmt.toggle} title={kpiFmt.tooltipHint} expanded={kpiFmt.detailed} />
        <KpiTile label={selectedDay ? `Pago (${selectedLabel})` : "Pago"} value={fv(pago).value} unit={fv(pago).unit} sparkValues={pagoDiaSeg} sparkColor="var(--red)" tone="red" onClick={kpiFmt.toggle} title={kpiFmt.tooltipHint} expanded={kpiFmt.detailed} />
        <KpiTile label={selectedDay ? `A pagar (${selectedLabel})` : "A pagar"} value={fv(aPagar).value} unit={fv(aPagar).unit} sparkValues={aPagarDiaSeg} sparkColor="var(--amber)" tone="amber" onClick={kpiFmt.toggle} title={kpiFmt.tooltipHint} expanded={kpiFmt.detailed} />
      </div>

      {selectedDay && (
        <DrilldownBadge drilldown={{ type: 'dia', value: selectedDay, label: `Dia ${selectedLabel}` }} onClear={() => setSelectedDay(null)} />
      )}

      {/* Pulso de receitas/despesas — barras diarias clicaveis com tooltip */}
      {(() => {
        const MESES_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        const barW = 14;
        const gap = 3;
        const PulseBars = ({ data, valueKey, color, title, chipLabel, chipValue }) => {
          const maxVal = Math.max(...data.map(d => d[valueKey]), 1);
          const totalW = data.length * (barW + gap);
          const [hover, setHover] = useState(null);
          return (
            <div className="card">
              <div className="card-title-row">
                <h2 className="card-title">{title}</h2>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className={`chip ${color}`}>{chipLabel} · {B.fmt(chipValue)}</span>
                  {selectedDay && <span className="chip cyan">Dia {selectedLabel}</span>}
                </div>
              </div>
              <div style={{ overflowX: 'auto', overflowY: 'visible', paddingBottom: 4, position: 'relative' }}>
                {hover != null && (() => {
                  const d = data[hover.idx];
                  if (!d) return null;
                  const v = d[valueKey];
                  // Clamp tooltip dentro do container: nas pontas (dia 1, 2, … e últimos do ano)
                  // o translateX(-50%) jogava o tooltip pra fora da tela.
                  const tipApproxW = 140;
                  const halfTip = tipApproxW / 2;
                  const tipX = Math.max(halfTip + 4, Math.min(totalW - halfTip - 4, hover.x));
                  return (
                    <div style={{
                      position: 'absolute', left: tipX, top: -6, transform: 'translateX(-50%)',
                      background: 'rgba(10,20,26,0.95)', border: '1px solid var(--border-2)',
                      borderRadius: 6, padding: '6px 10px', zIndex: 20, pointerEvents: 'none',
                      whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--mute)', marginBottom: 2 }}>{d.label}/{dailyData.y}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: v > 0 ? `var(--${color})` : 'var(--mute)' }}>{B.fmt(v)}</div>
                    </div>
                  );
                })()}
                <div style={{ width: totalW, height: 200, display: 'flex', alignItems: 'flex-end', gap }}>
                  {data.map((d, i) => {
                    const v = d[valueKey];
                    const h = v > 0 ? Math.max((v / maxVal) * 100, 1) : 0;
                    const isSelected = d.key === selectedDay;
                    const isHovered = hover != null && hover.idx === i;
                    const isFirstOfMonth = d.date.getDate() === 1;
                    return (
                      <div key={i} style={{
                        width: barW, height: `${h}%`, minHeight: v > 0 ? 3 : 0,
                        background: isHovered ? 'var(--cyan)' : (isSelected ? 'var(--cyan)' : `var(--${color})`),
                        opacity: isHovered ? 1 : (isSelected ? 1 : (selectedDay && !isSelected ? 0.3 : 0.85)),
                        borderRadius: '3px 3px 0 0', cursor: 'pointer', flexShrink: 0,
                        borderLeft: isFirstOfMonth ? '2px solid rgba(255,255,255,0.2)' : 'none',
                        transition: 'opacity 0.15s, background 0.1s',
                      }}
                        onMouseEnter={() => setHover({ idx: i, x: i * (barW + gap) + barW / 2 })}
                        onMouseLeave={() => setHover(null)}
                        onClick={() => setSelectedDay(d.key === selectedDay ? null : d.key)}
                      />
                    );
                  })}
                </div>
                <div style={{ width: totalW, display: 'flex', position: 'relative', height: 20 }}>
                  {MESES_LABELS.map((m, mi) => {
                    const firstDay = data.findIndex(d => d.date.getMonth() === mi);
                    if (firstDay < 0) return null;
                    return (
                      <span key={mi} style={{
                        position: 'absolute', left: firstDay * (barW + gap),
                        fontSize: 11, color: 'var(--mute)', fontWeight: 600,
                      }}>{m}</span>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        };
        return (
          <>
            <PulseBars data={dailyData.diasDoAno} valueKey="rec" color="green" title="Pulso de receitas" chipLabel="Recebido" chipValue={recebido} />
            <PulseBars data={dailyData.diasDoAno} valueKey="desp" color="red" title="Pulso de despesas" chipLabel="Pago" chipValue={pago} />
          </>
        );
      })()}

      {/* Tabela do dia selecionado */}
      {selectedDay && (
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Movimentações do dia {selectedLabel}</h2>
            <button className="btn-ghost" onClick={() => setSelectedDay(null)}>× Limpar filtro</button>
          </div>
          <div className="t-scroll" style={{ maxHeight: 400 }}>
            <table className="t">
              <thead>
                <tr><th>Tipo</th><th>Categoria</th><th>Cliente / Fornecedor</th><th className="num">Valor</th></tr>
              </thead>
              <tbody>
                {dayDetail.length === 0 && (
                  <tr><td colSpan="4" style={{ textAlign: "center", color: "var(--mute)", padding: 18 }}>Sem movimentações neste dia</td></tr>
                )}
                {dayDetail.map((d, i) => (
                  <tr key={i}>
                    <td><span style={{ color: d.tipo === 'Receita' ? 'var(--green)' : 'var(--red)', fontWeight: 600, fontSize: 11 }}>{d.tipo}</span></td>
                    <td>{d.categoria}</td>
                    <td>{d.nome}</td>
                    <td className={`num ${d.valor >= 0 ? 'green' : 'red'}`}>{B.fmt(d.valor)}</td>
                  </tr>
                ))}
                {dayDetail.length > 0 && (
                  <tr className="total">
                    <td colSpan="3">Total do dia ({dayDetail.length} lançamentos)</td>
                    <td className="num" style={{ color: dayDetail.reduce((s, d) => s + d.valor, 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {B.fmt(dayDetail.reduce((s, d) => s + d.valor, 0))}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Saldo real (planilha de saldos) + projeção futura */}
      {(function() {
        const SALDOS = (window.BIT_EXTRAS && window.BIT_EXTRAS.saldos) || null;
        if (!SALDOS || !SALDOS.last) return null;
        const last = SALDOS.last;
        const contas = Object.entries(last.contas).sort((a, b) => b[1] - a[1]);
        // Projeção: saldo último + ∑(a receber) − ∑(a pagar) acumulado por mês.
        // Usa BIT_SEGMENTS.a_pagar_receber pra somar ainda-pendente por mês futuro.
        const seg = (window.BIT_SEGMENTS || {}).a_pagar_receber || { MONTH_DATA: [] };
        const lastDate = new Date(last.data);
        const lastMonthIdx = lastDate.getMonth();
        const proj = [];
        let saldo = last.total;
        for (let i = lastMonthIdx + 1; i < 12; i++) {
          const md = seg.MONTH_DATA[i] || { receita: 0, despesa: 0 };
          saldo += (md.receita || 0) - (md.despesa || 0);
          proj.push({ m: B.MONTHS_FULL[i] || `M${i+1}`, saldo });
        }
        const series = [last.total, ...proj.map(p => p.saldo)];
        const labels = ['Hoje', ...proj.map(p => p.m.slice(0,3))];
        const minProj = Math.min(...series);
        const maxProj = Math.max(...series);
        return (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title-row">
              <h2 className="card-title">Saldo atual e projeção</h2>
              <span className="chip cyan">Última atualização: {last.data.split('-').reverse().join('/')}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 18 }}>
              {contas.map(([nome, v]) => (
                <div key={nome} className="indicator-card" style={{ padding: 12 }}>
                  <div className="kpi-label" style={{ fontSize: 10 }}>{nome}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16, color: v >= 0 ? 'var(--green)' : 'var(--red)' }}>{B.fmt(v)}</div>
                </div>
              ))}
              <div className="indicator-card" style={{ padding: 12, background: 'rgba(34,211,238,0.08)' }}>
                <div className="kpi-label" style={{ fontSize: 10 }}>Total</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18, color: 'var(--cyan)' }}>{B.fmt(last.total)}</div>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <div className="kpi-label" style={{ marginBottom: 6 }}>Projeção mensal (saldo + a receber − a pagar)</div>
              <TrendChart values={series} labels={labels} color="var(--cyan)" height={isMobile ? 160 : 200} showPoints={true} showLabels={!isMobile} gradientId="ts-proj" />
              <div style={{ display: 'flex', gap: 24, marginTop: 8, fontSize: 11, color: 'var(--mute)' }}>
                <span>Mínima projetada: <b style={{ color: minProj >= 0 ? 'var(--green)' : 'var(--red)' }}>{B.fmt(minProj)}</b></span>
                <span>Máxima projetada: <b style={{ color: 'var(--green)' }}>{B.fmt(maxProj)}</b></span>
                <span>Final do ano: <b style={{ color: series[series.length-1] >= 0 ? 'var(--green)' : 'var(--red)' }}>{B.fmt(series[series.length-1])}</b></span>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="row" style={{ gridTemplateColumns: "minmax(0, 7fr) minmax(0, 5fr)" }}>
        <div className="card">
          <h2 className="card-title">Saldo acumulado por mês</h2>
          <div style={{ display: "flex", gap: 24, marginBottom: 14, flexWrap: "wrap" }}>
            <div><div className="kpi-label">Saldo Máximo</div><div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--green)" }}>{B.fmt(sMax)}</div></div>
            <div><div className="kpi-label">Saldo Mínimo</div><div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--red)" }}>{B.fmt(sMin)}</div></div>
            <div><div className="kpi-label">Saldo Médio</div><div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--cyan)" }}>{B.fmt(sMed)}</div></div>
            {SALDOS_REAIS && SALDOS_REAIS.last && (
              <div><div className="kpi-label">Saldo atual (planilha)</div><div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--cyan)" }}>{B.fmt(SALDOS_REAIS.last.total)}</div></div>
            )}
          </div>
          <TrendChart values={saldosCum} labels={B.MONTHS} color="var(--cyan)" height={isMobile ? 160 : 200} showPoints={true} showLabels={!isMobile} gradientId="ts-saldo" />
          <div className="status-line" style={{ marginTop: 6 }}>
            Saldo cumulativo: parte de R$ {(B.fmt(saldoInicial) || "0").replace("R$ ", "")} no início do ano e acumula receitas − despesas mês a mês.
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Fluxo a vencer (saldo projetado dia a dia)</h2>
          <div className="status-line" style={{ marginBottom: 8 }}>
            {fluxoFuturoFull.length} lançamentos a partir de hoje
            {SALDOS_REAIS && SALDOS_REAIS.last && (
              <> · saldo inicial <b style={{ color: "var(--cyan)" }}>{B.fmt(SALDOS_REAIS.last.total)}</b></>
            )}
          </div>
          {/* Banner de risco de caixa */}
          {riscoAnalise && (
            <div className={`tesouraria-risco ${riscoAnalise.primeiroNegativo ? "risco-critico" : riscoAnalise.minSaldo < saldoBaseInicial * 0.3 ? "risco-atencao" : "risco-ok"}`}>
              {riscoAnalise.primeiroNegativo ? (
                <>
                  <div className="risco-icon">⚠</div>
                  <div className="risco-body">
                    <div className="risco-titulo">SALDO ENTRA EM VERMELHO EM <b>{riscoAnalise.primeiroNegativo.data}</b> {riscoAnalise.diasAteCrise != null && <span className="risco-dias">(em {riscoAnalise.diasAteCrise} {riscoAnalise.diasAteCrise === 1 ? "dia" : "dias"})</span>}</div>
                    <div className="risco-detalhe">
                      Lançamento crítico: <b>{(riscoAnalise.primeiroNegativo.movimento || "").slice(0, 40)}</b> · {B.fmt(riscoAnalise.primeiroNegativo.valor)} · saldo cai pra <b style={{ color: "var(--red)" }}>{B.fmt(riscoAnalise.primeiroNegativo.saldo)}</b>
                    </div>
                    <div className="risco-min">
                      Mínimo projetado: <b style={{ color: "var(--red)" }}>{B.fmt(riscoAnalise.minSaldo)}</b> em {riscoAnalise.minSaldoData} · Saldo final no horizonte: <b style={{ color: riscoAnalise.saldoFinal >= 0 ? "var(--green)" : "var(--red)" }}>{B.fmt(riscoAnalise.saldoFinal)}</b>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="risco-icon">{riscoAnalise.minSaldo < saldoBaseInicial * 0.3 ? "⚠" : "✓"}</div>
                  <div className="risco-body">
                    <div className="risco-titulo">
                      {riscoAnalise.minSaldo < saldoBaseInicial * 0.3
                        ? "SALDO MÍNIMO PROJETADO ABAIXO DE 30% DO ATUAL"
                        : "CAIXA SAUDÁVEL NO HORIZONTE"}
                    </div>
                    <div className="risco-detalhe">
                      Mínimo: <b style={{ color: riscoAnalise.minSaldo < saldoBaseInicial * 0.3 ? "var(--amber)" : "var(--green)" }}>{B.fmt(riscoAnalise.minSaldo)}</b> em {riscoAnalise.minSaldoData} · Final: <b style={{ color: "var(--green)" }}>{B.fmt(riscoAnalise.saldoFinal)}</b>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          {/* Mini chart de saldo dia-a-dia projetado */}
          {saldoDiario.length > 1 && (
            <div className="tesouraria-mini-chart">
              <SaldoProjetadoChart pontos={saldoDiario} saldoInicial={saldoBaseInicial} />
            </div>
          )}
          <div className="t-scroll" style={{ maxHeight: 380 }}>
            <table className="t">
              <thead>
                <tr><th>Vence</th><th>Cliente / Fornecedor</th><th className="num">Movimento</th><th className="num">Saldo</th></tr>
              </thead>
              <tbody>
                {fluxoFuturo.length === 0 && (
                  <tr><td colSpan="4" style={{ textAlign: "center", color: "var(--fg-3)", padding: 20 }}>Sem lançamentos a vencer</td></tr>
                )}
                {fluxoFuturo.map((e, i) => {
                  const saldoCol = e[6];
                  const dataAtual = e[0];
                  const dataAnterior = i > 0 ? fluxoFuturo[i - 1][0] : null;
                  const novoBloco = dataAnterior !== dataAtual; // primeira linha de cada dia
                  // Linha "crítica" se este é o primeiro lançamento que torna o saldo negativo
                  const saldoAnterior = i > 0 ? fluxoFuturo[i - 1][6] : saldoBaseInicial;
                  const cruzouZero = saldoAnterior >= 0 && saldoCol < 0;
                  return (
                    <tr key={i} className={cruzouZero ? "tesouraria-row-critica" : ""} style={novoBloco && i > 0 ? { borderTop: "1px solid var(--border-2)" } : {}}>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: novoBloco ? 700 : 400, color: novoBloco ? "var(--text)" : "var(--fg-3)" }}>{novoBloco ? dataAtual : ""}</td>
                      <td style={{ fontSize: 11 }}>{(e[3] || e[2] || "").slice(0, 32)}</td>
                      <td className={`num ${e[4] < 0 ? "red" : "green"}`} style={{ fontSize: 11 }}>{B.fmt(e[4])}</td>
                      <td className="num" style={{ fontSize: 11, fontWeight: 600, color: saldoCol < 0 ? "var(--red)" : saldoCol < saldoBaseInicial * 0.3 ? "var(--amber)" : "var(--cyan)" }}>{B.fmt(saldoCol)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {fluxoFuturoFull.length > 60 && (
            <div className="status-line" style={{ marginTop: 8, fontSize: 11, textAlign: "center" }}>
              Mostrando primeiros 60 de {fluxoFuturoFull.length} lançamentos · análise de risco usa todos
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Mini chart SVG do saldo projetado dia-a-dia, com marcador da data crítica
const SaldoProjetadoChart = ({ pontos, saldoInicial }) => {
  const W = 800, H = 160, padX = 40, padTop = 16, padBottom = 32;
  if (pontos.length < 2) return null;
  const valores = [saldoInicial, ...pontos.map(p => p.saldo)];
  const min = Math.min(0, ...valores);
  const max = Math.max(...valores);
  const range = (max - min) || 1;
  const stepX = (W - padX * 2) / (pontos.length - 0);
  const xOf = (i) => padX + i * stepX;
  const yOf = (v) => padTop + (1 - (v - min) / range) * (H - padTop - padBottom);
  const zeroY = yOf(0);
  // Path da linha
  const points = pontos.map((p, i) => `${xOf(i + 1)},${yOf(p.saldo)}`).join(" ");
  const startPoint = `${xOf(0)},${yOf(saldoInicial)}`;
  // Área pra preenchimento
  const areaPath = `M ${startPoint} L ${points.replace(/ /g, " L ")} L ${xOf(pontos.length)},${yOf(min)} L ${xOf(0)},${yOf(min)} Z`;
  // Detecta primeira data com saldo negativo
  let critIdx = -1;
  for (let i = 0; i < pontos.length; i++) {
    if (pontos[i].saldo < 0) { critIdx = i; break; }
  }
  // Labels de data: a cada N pontos pra não amassar
  const labelStep = Math.max(1, Math.ceil(pontos.length / 8));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: H, marginBottom: 12 }}>
      <defs>
        <linearGradient id="ts-proj-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* zero line */}
      {zeroY > padTop && zeroY < H - padBottom && (
        <line x1={padX} y1={zeroY} x2={W - 10} y2={zeroY} stroke="rgba(239, 68, 68, 0.4)" strokeDasharray="4 4" strokeWidth="1" />
      )}
      {zeroY > padTop && zeroY < H - padBottom && (
        <text x={W - 10} y={zeroY - 4} textAnchor="end" fontSize="10" fill="var(--red)" fontFamily="var(--font-mono)">R$ 0</text>
      )}
      {/* área */}
      <path d={areaPath} fill="url(#ts-proj-grad)" />
      {/* linha */}
      <polyline points={`${startPoint} ${points}`} fill="none" stroke="var(--cyan)" strokeWidth="2" />
      {/* marcador inicial */}
      <circle cx={xOf(0)} cy={yOf(saldoInicial)} r="4" fill="var(--cyan)" stroke="#0a141a" strokeWidth="2" />
      <text x={xOf(0)} y={yOf(saldoInicial) - 8} textAnchor="middle" fontSize="10" fill="var(--cyan)" fontFamily="var(--font-mono)">Hoje</text>
      {/* marcador crítico */}
      {critIdx >= 0 && (
        <g>
          <line x1={xOf(critIdx + 1)} y1={padTop} x2={xOf(critIdx + 1)} y2={H - padBottom} stroke="var(--red)" strokeDasharray="3 3" strokeWidth="1.2" />
          <circle cx={xOf(critIdx + 1)} cy={yOf(pontos[critIdx].saldo)} r="5" fill="var(--red)" stroke="#0a141a" strokeWidth="2" />
          <text x={xOf(critIdx + 1)} y={padTop - 2} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--red)">{pontos[critIdx].data}</text>
        </g>
      )}
      {/* labels de data no eixo x */}
      {pontos.map((p, i) => {
        if (i % labelStep !== 0 && i !== pontos.length - 1) return null;
        return (
          <text key={i} x={xOf(i + 1)} y={H - 12} textAnchor="middle" fontSize="9" fill="var(--mute)">{p.data.slice(0, 5)}</text>
        );
      })}
    </svg>
  );
};

const PageComparativo = ({ statusFilter, drilldown, setDrilldown, year, months }) => {
  const B = useMemo(() => window.getBit(statusFilter, drilldown, year, months), [statusFilter, drilldown, year, months]);
  const refYear = window.REF_YEAR || new Date().getFullYear();
  const fmt = (B && B.fmt) || (n => `R$ ${n.toFixed(2)}`);
  const fmtPct = (B && B.fmtPct) || (n => `${n.toFixed(1)}%`);

  // Estado dos 2 periodos comparados — cada um eh { y, kind: 'mes'|'trim'|'ano', val }
  const [p1, setP1] = useState({ y: refYear, kind: "trim", val: 1 });
  const [p2, setP2] = useState({ y: refYear, kind: "trim", val: 2 });
  const [expanded, setExpanded] = useState({ Receita: true, Despesa: true });
  const [expandedCats, setExpandedCats] = useState(() => new Set());
  const toggleCat = (key) => setExpandedCats(s => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  // Retorna lançamentos individuais de (kind, categoria) que caem em P1 ou P2.
  // Usado pra expandir linha de categoria mostrando títulos individuais.
  const getCatTx = (kind, cat) => {
    const allTx = window.ALL_TX || [];
    const filterTxFn = window.filterTx;
    const sf = statusFilter || window.BIT_FILTER || "realizado";
    const txFiltered = filterTxFn ? filterTxFn(allTx, sf, null) : allTx;
    const b1 = periodBounds(p1), b2 = periodBounds(p2);
    const inPeriod = (mes, b) => {
      const ini = `${b.y}-${String(b.mIni).padStart(2, "0")}`;
      const fim = `${b.y}-${String(b.mFim).padStart(2, "0")}`;
      return mes >= ini && mes <= fim;
    };
    const out = [];
    for (const row of txFiltered) {
      if (row[0] !== kind || row[3] !== cat) continue;
      const inP1 = inPeriod(row[1], b1), inP2 = inPeriod(row[1], b2);
      if (!inP1 && !inP2) continue;
      out.push({ mes: row[1], dia: row[2], parte: kind === "r" ? (row[4] || "—") : (row[7] || "—"), valor: row[5], inP1, inP2 });
    }
    return out.sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
  };

  // Calcula bounds de mes do periodo
  const periodBounds = (p) => {
    if (p.kind === "ano") return { y: p.y, mIni: 1, mFim: 12 };
    if (p.kind === "trim") {
      const tStart = (p.val - 1) * 3 + 1;
      return { y: p.y, mIni: tStart, mFim: tStart + 2 };
    }
    return { y: p.y, mIni: p.val, mFim: p.val }; // mes
  };
  const periodLabel = (p) => {
    if (p.kind === "ano") return `${p.y} · Ano completo`;
    if (p.kind === "trim") {
      const lbl = ["jan-mar", "abr-jun", "jul-set", "out-dez"][p.val - 1];
      return `${p.y} · Trim ${p.val} (${lbl})`;
    }
    const mn = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][p.val - 1];
    return `${mn}/${p.y}`;
  };

  // Filtra ALL_TX por periodo + statusFilter; agrega receitas/despesas por categoria
  const aggregate = (p) => {
    const allTx = window.ALL_TX || [];
    const filterTx = window.filterTx;
    const sf = statusFilter || window.BIT_FILTER || "realizado";
    const txFiltered = filterTx ? filterTx(allTx, sf, null) : allTx;
    const { y, mIni, mFim } = periodBounds(p);
    const mIniStr = `${y}-${String(mIni).padStart(2, "0")}`;
    const mFimStr = `${y}-${String(mFim).padStart(2, "0")}`;
    let totalRec = 0, totalDesp = 0;
    const recCat = new Map(), despCat = new Map();
    for (const row of txFiltered) {
      const [kind, mes, , categoria, , valor] = row;
      if (!mes || mes < mIniStr || mes > mFimStr) continue;
      if (kind === "r") {
        totalRec += valor;
        recCat.set(categoria, (recCat.get(categoria) || 0) + valor);
      } else {
        totalDesp += valor;
        despCat.set(categoria, (despCat.get(categoria) || 0) + valor);
      }
    }
    return { totalRec, totalDesp, liq: totalRec - totalDesp, recCat, despCat };
  };

  const a1 = useMemo(() => aggregate(p1), [p1, statusFilter]);
  const a2 = useMemo(() => aggregate(p2), [p2, statusFilter]);

  const safePct = (a, b) => b !== 0 ? (a / b) * 100 : (a !== 0 ? 100 : 0);
  const diffReceita = a2.totalRec - a1.totalRec;
  const diffReceitaPct = safePct(diffReceita, a1.totalRec);
  const diffDespesa = a2.totalDesp - a1.totalDesp;
  const diffDespesaPct = safePct(diffDespesa, a1.totalDesp);
  const diffLiq = a2.liq - a1.liq;
  const diffLiqPct = safePct(diffLiq, Math.abs(a1.liq) || 1);

  // Top categorias unidas (union de p1 + p2)
  const allRecCats = new Set([...a1.recCat.keys(), ...a2.recCat.keys()]);
  const allDespCats = new Set([...a1.despCat.keys(), ...a2.despCat.keys()]);

  // Selector compacto: ano + tipo + valor
  const PeriodPicker = ({ value, onChange, label }) => {
    const yearsAvail = window.AVAILABLE_YEARS || [refYear];
    const monthOpts = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return (
      <div style={{ marginBottom: 12 }}>
        <div className="filter-mini-label">{label}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
          <select className="filter-select" value={value.y} onChange={e => onChange({ ...value, y: Number(e.target.value) })}>
            {yearsAvail.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="filter-select" value={value.kind} onChange={e => onChange({ ...value, kind: e.target.value, val: e.target.value === "mes" ? 1 : (e.target.value === "trim" ? 1 : 1) })}>
            <option value="mes">Mês</option>
            <option value="trim">Trimestre</option>
            <option value="ano">Ano completo</option>
          </select>
        </div>
        {value.kind === "mes" && (
          <select className="filter-select" style={{ width: "100%" }} value={value.val} onChange={e => onChange({ ...value, val: Number(e.target.value) })}>
            {monthOpts.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        )}
        {value.kind === "trim" && (
          <select className="filter-select" style={{ width: "100%" }} value={value.val} onChange={e => onChange({ ...value, val: Number(e.target.value) })}>
            <option value={1}>Trim 1 (jan-mar)</option>
            <option value={2}>Trim 2 (abr-jun)</option>
            <option value={3}>Trim 3 (jul-set)</option>
            <option value={4}>Trim 4 (out-dez)</option>
          </select>
        )}
        <div style={{ marginTop: 4, color: "var(--mute)", fontSize: 11, letterSpacing: "0.04em" }}>{periodLabel(value)}</div>
      </div>
    );
  };

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Comparativo</h1>
          <div className="status-line">{periodLabel(p1)} vs {periodLabel(p2)}</div>
        </div>
        <div className="actions">
        </div>
      </div>

      <DrilldownBadge drilldown={drilldown} onClear={() => setDrilldown && setDrilldown(null)} />
      <StatusEmptyHint statusFilter={statusFilter} bit={B} />

      <div className="row row-3-9">
        <div style={{ display: "grid", gap: 16 }}>
          <div className="card">
            <h2 className="card-title">Filtragem de datas</h2>
            <PeriodPicker value={p1} onChange={setP1} label="Data comparativa 1" />
            <PeriodPicker value={p2} onChange={setP2} label="Data comparativa 2" />
          </div>

          <div className="card">
            <h2 className="card-title">Indicadores principais</h2>
            <div style={{ display: "grid", gap: 12 }}>
              <div className={`indicator-card ${diffReceita >= 0 ? "" : "red"}`}>
                <div className="kpi-label">Diferença na receita</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: diffReceita >= 0 ? "var(--green)" : "var(--red)", letterSpacing: "-0.02em" }}>{fmt(diffReceita)}</div>
                <div className={`kpi-delta ${diffReceita >= 0 ? "up" : "down"}`}>{fmtPct(diffReceitaPct)}</div>
              </div>
              <div className={`indicator-card ${diffDespesa <= 0 ? "" : "red"}`}>
                <div className="kpi-label">Diferença nas despesas</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: diffDespesa <= 0 ? "var(--green)" : "var(--red)", letterSpacing: "-0.02em" }}>{fmt(diffDespesa)}</div>
                <div className={`kpi-delta ${diffDespesa <= 0 ? "up" : "down"}`}>{fmtPct(diffDespesaPct)}</div>
              </div>
              <div className={`indicator-card ${diffLiq >= 0 ? "" : "red"}`}>
                <div className="kpi-label">Diferença do valor líquido</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: diffLiq >= 0 ? "var(--green)" : "var(--red)", letterSpacing: "-0.02em" }}>{fmt(diffLiq)}</div>
                <div className={`kpi-delta ${diffLiq >= 0 ? "up" : "down"}`}>{fmtPct(diffLiqPct)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Análise comparativa entre períodos</h2>
          </div>
          <div className="t-scroll" style={{ maxHeight: 540 }}>
            <table className="t">
              <thead>
                <tr>
                  <th>Receita / Despesa</th>
                  <th className="num">{periodLabel(p1)}</th>
                  <th className="num">{periodLabel(p2)}</th>
                  <th className="num">Δ Comparativo</th>
                  <th className="num">%</th>
                </tr>
              </thead>
              <tbody>
                {/* Header Receita */}
                <tr className="section">
                  <td>
                    <button onClick={() => setExpanded(s => ({ ...s, Receita: !s.Receita }))} style={{ background: "transparent", border: 0, color: "inherit", padding: 0, fontWeight: 700, fontFamily: "inherit", fontSize: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span className="chev">{expanded.Receita ? "−" : "+"}</span>Receita
                    </button>
                  </td>
                  <td className="num bold green">{fmt(a1.totalRec)}</td>
                  <td className="num bold green">{fmt(a2.totalRec)}</td>
                  <td className={`num bold ${diffReceita >= 0 ? "green" : "red"}`}>{fmt(diffReceita)}</td>
                  <td className={`num bold ${diffReceita >= 0 ? "green" : "red"}`}>{fmtPct(diffReceitaPct)}</td>
                </tr>
                {expanded.Receita && [...allRecCats].sort((x, y) => (a2.recCat.get(y) || 0) + (a1.recCat.get(y) || 0) - ((a2.recCat.get(x) || 0) + (a1.recCat.get(x) || 0))).map((cat, i) => {
                  const v1 = a1.recCat.get(cat) || 0;
                  const v2 = a2.recCat.get(cat) || 0;
                  const diff = v2 - v1;
                  const pct = safePct(diff, v1);
                  const catKey = `r:${cat}`;
                  const isOpen = expandedCats.has(catKey);
                  return (
                    <React.Fragment key={`r${i}`}>
                      <tr>
                        <td style={{ paddingLeft: 24 }}>
                          <button onClick={() => toggleCat(catKey)} style={{ background: "transparent", border: 0, color: "inherit", padding: 0, fontFamily: "inherit", fontSize: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }} title="Expandir lançamentos">
                            <span className="chev">{isOpen ? "−" : "+"}</span>{cat}
                          </button>
                        </td>
                        <td className="num green">{v1 !== 0 ? fmt(v1) : "—"}</td>
                        <td className="num green">{v2 !== 0 ? fmt(v2) : "—"}</td>
                        <td className={`num ${diff >= 0 ? "green" : "red"}`}>{fmt(diff)}</td>
                        <td className={`num ${diff >= 0 ? "green" : "red"}`}>{fmtPct(pct)}</td>
                      </tr>
                      {isOpen && getCatTx("r", cat).slice(0, 20).map((t, j) => (
                        <tr key={`r${i}_${j}`} style={{ background: "var(--surface-2)" }}>
                          <td style={{ paddingLeft: 48, fontSize: 12, color: "var(--fg-2)" }}>
                            <span style={{ color: "var(--mute)", marginRight: 8 }}>{String(t.dia).padStart(2, "0")}/{t.mes.slice(5, 7)}/{t.mes.slice(0, 4)}</span>
                            {t.parte}
                          </td>
                          <td className="num green" style={{ fontSize: 12 }}>{t.inP1 ? fmt(t.valor) : "—"}</td>
                          <td className="num green" style={{ fontSize: 12 }}>{t.inP2 ? fmt(t.valor) : "—"}</td>
                          <td style={{ fontSize: 12, color: "var(--mute)" }}>—</td>
                          <td style={{ fontSize: 12, color: "var(--mute)" }}>—</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
                {/* Header Despesa */}
                <tr className="section">
                  <td>
                    <button onClick={() => setExpanded(s => ({ ...s, Despesa: !s.Despesa }))} style={{ background: "transparent", border: 0, color: "inherit", padding: 0, fontWeight: 700, fontFamily: "inherit", fontSize: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span className="chev">{expanded.Despesa ? "−" : "+"}</span>Despesa
                    </button>
                  </td>
                  <td className="num bold red">{fmt(a1.totalDesp)}</td>
                  <td className="num bold red">{fmt(a2.totalDesp)}</td>
                  <td className={`num bold ${diffDespesa <= 0 ? "green" : "red"}`}>{fmt(diffDespesa)}</td>
                  <td className={`num bold ${diffDespesa <= 0 ? "green" : "red"}`}>{fmtPct(diffDespesaPct)}</td>
                </tr>
                {expanded.Despesa && [...allDespCats].sort((x, y) => (a2.despCat.get(y) || 0) + (a1.despCat.get(y) || 0) - ((a2.despCat.get(x) || 0) + (a1.despCat.get(x) || 0))).map((cat, i) => {
                  const v1 = a1.despCat.get(cat) || 0;
                  const v2 = a2.despCat.get(cat) || 0;
                  const diff = v2 - v1;
                  const pct = safePct(diff, v1);
                  const catKey = `d:${cat}`;
                  const isOpen = expandedCats.has(catKey);
                  return (
                    <React.Fragment key={`d${i}`}>
                      <tr>
                        <td style={{ paddingLeft: 24 }}>
                          <button onClick={() => toggleCat(catKey)} style={{ background: "transparent", border: 0, color: "inherit", padding: 0, fontFamily: "inherit", fontSize: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }} title="Expandir lançamentos">
                            <span className="chev">{isOpen ? "−" : "+"}</span>{cat}
                          </button>
                        </td>
                        <td className="num red">{v1 !== 0 ? fmt(v1) : "—"}</td>
                        <td className="num red">{v2 !== 0 ? fmt(v2) : "—"}</td>
                        <td className={`num ${diff <= 0 ? "green" : "red"}`}>{fmt(diff)}</td>
                        <td className={`num ${diff <= 0 ? "green" : "red"}`}>{fmtPct(pct)}</td>
                      </tr>
                      {isOpen && getCatTx("d", cat).slice(0, 20).map((t, j) => (
                        <tr key={`d${i}_${j}`} style={{ background: "var(--surface-2)" }}>
                          <td style={{ paddingLeft: 48, fontSize: 12, color: "var(--fg-2)" }}>
                            <span style={{ color: "var(--mute)", marginRight: 8 }}>{String(t.dia).padStart(2, "0")}/{t.mes.slice(5, 7)}/{t.mes.slice(0, 4)}</span>
                            {t.parte}
                          </td>
                          <td className="num red" style={{ fontSize: 12 }}>{t.inP1 ? fmt(t.valor) : "—"}</td>
                          <td className="num red" style={{ fontSize: 12 }}>{t.inP2 ? fmt(t.valor) : "—"}</td>
                          <td style={{ fontSize: 12, color: "var(--mute)" }}>—</td>
                          <td style={{ fontSize: 12, color: "var(--mute)" }}>—</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
                <tr className="total">
                  <td>Total líquido</td>
                  <td className="num">{fmt(a1.liq)}</td>
                  <td className="num">{fmt(a2.liq)}</td>
                  <td className={`num ${diffLiq >= 0 ? "green" : "red"}`}>{fmt(diffLiq)}</td>
                  <td className={`num ${diffLiq >= 0 ? "green" : "red"}`}>{fmtPct(diffLiqPct)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== PageRelatorio =====
// Carrega report.json (gerado offline por generate-report.cjs) e renderiza
// um relatorio executivo imprimivel (Ctrl+P -> Save as PDF).
const PageRelatorio = ({ year, statusFilter }) => {
  const refYear = window.REF_YEAR || new Date().getFullYear();
  // Hooks de dados — DEVEM ficar antes de qualquer early return pra não violar
  // a ordem dos hooks. Os useMemo dependem de periodYear/periodMonth declarados abaixo
  // mas useMemo aceita refs do escopo via closure.
  // Estado do periodo a renderizar (defaults: ano corrente YTD)
  const [periodYear, setPeriodYear] = useState(() => {
    try { var p = JSON.parse(localStorage.getItem('bi.report.period') || 'null'); return (p && p.year) || (year || refYear); } catch (e) { return year || refYear; }
  });
  const [periodMonth, setPeriodMonth] = useState(() => {
    try { var p = JSON.parse(localStorage.getItem('bi.report.period') || 'null'); return (p && p.month) || 0; } catch (e) { return 0; } // 0 = ano completo
  });
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  // Lista de períodos com report disponível (auto-descoberta via HEAD)
  const [availablePeriods, setAvailablePeriods] = useState([]);

  // Cards reativos ao período (year + month) — antes usavam window.BIT global YTD
  // Mantidos no topo (regra dos hooks) — não chamar dentro de early returns
  const B = useMemo(
    () => window.getBit('realizado', null, periodYear, periodMonth),
    [periodYear, periodMonth]
  );
  const Bprev = useMemo(
    () => window.getBit('a_pagar_receber', null, periodYear, periodMonth),
    [periodYear, periodMonth]
  );

  // resolve o nome do arquivo conforme periodo
  const reportFileName = (y, m) => {
    if (m && m > 0) return `report-${y}-${String(m).padStart(2,'0')}.json`;
    if (y === refYear) return 'report.json'; // default mantem nome principal
    return `report-${y}.json`;
  };

  // Auto-descoberta dos períodos com report disponível (rodando 1x ao montar)
  useEffect(() => {
    let cancelled = false;
    const candidates = [
      { year: refYear, month: 0, file: 'report.json', label: `Ano ${refYear} (YTD)` },
      ...[1,2,3,4,5,6,7,8,9,10,11,12].map(m => ({
        year: refYear, month: m,
        file: `report-${refYear}-${String(m).padStart(2,'0')}.json`,
        label: `${MONTH_OPTIONS[m].label}/${refYear}`,
      })),
    ];
    Promise.all(candidates.map(c =>
      fetch(c.file, { method: 'HEAD', cache: 'no-store' })
        .then(r => r.ok ? c : null)
        .catch(() => null)
    )).then(results => {
      if (cancelled) return;
      setAvailablePeriods(results.filter(Boolean));
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setGenerating(false);
    setError(null);
    setReport(null);
    try { localStorage.setItem('bi.report.period', JSON.stringify({ year: periodYear, month: periodMonth })); } catch (e) {}
    const file = reportFileName(periodYear, periodMonth);

    // Timeout de 10s como guard contra "fica carregando" infinito
    const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const timeoutId = setTimeout(() => {
      if (controller) controller.abort();
      if (cancelled) return;
      setError(`Timeout ao buscar ${file} (>10s)`);
      setLoading(false);
      setGenerating(false);
    }, 10000);

    // 1) tenta o JSON pre-gerado (estatico). Se 404, cai no fallback de geracao on-demand.
    fetch(file, { cache: 'no-store', signal: controller && controller.signal })
      .then(r => {
        if (r.ok) return r.json();
        if (r.status === 404) return null; // sinaliza fallback
        throw new Error(`HTTP ${r.status} (arquivo ${file})`);
      })
      .then(data => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        if (data) {
          // tinha relatorio pre-gerado
          setReport(data);
          setLoading(false);
          return null;
        }
        // 2) Fallback: chama a API publica de geracao on-demand (se configurada)
        const apiUrl = window.BI_REPORT_API && /^https?:\/\//.test(window.BI_REPORT_API) ? window.BI_REPORT_API : null;
        if (!apiUrl) {
          // Sem API: marca como erro pra renderizar tela "ainda não foi gerado"
          setLoading(false);
          setGenerating(false);
          setError(`Relatório de ${reportFileName(periodYear, periodMonth)} ainda não foi gerado`);
          return null;
        }
        setLoading(false);
        setGenerating(true);
        return fetch(`${apiUrl}/generate-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            year: periodYear,
            month: periodMonth > 0 ? periodMonth : null,
          }),
        }).then(async (resp) => {
          if (cancelled) return;
          if (resp.status === 429) {
            const retry = resp.headers.get('Retry-After') || '3600';
            throw new Error(`Limite de geracao atingido. Tente novamente em ~${Math.ceil(Number(retry) / 60)} minutos.`);
          }
          if (!resp.ok) {
            const t = await resp.text().catch(() => '');
            throw new Error(`Falha ao gerar (HTTP ${resp.status}). ${t.slice(0,200)}`);
          }
          const generated = await resp.json();
          if (cancelled) return;
          setReport(generated);
          setGenerating(false);
        });
      })
      .catch(e => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        // AbortError do timeout já tratado acima
        if (e.name === 'AbortError') return;
        setError(e.message);
        setLoading(false);
        setGenerating(false);
      });
    return () => { cancelled = true; clearTimeout(timeoutId); if (controller) controller.abort(); };
  }, [periodYear, periodMonth]);

  const MONTH_OPTIONS = [
    { v: 0, label: "Ano completo" },
    { v: 1, label: "Janeiro" }, { v: 2, label: "Fevereiro" }, { v: 3, label: "Março" },
    { v: 4, label: "Abril" }, { v: 5, label: "Maio" }, { v: 6, label: "Junho" },
    { v: 7, label: "Julho" }, { v: 8, label: "Agosto" }, { v: 9, label: "Setembro" },
    { v: 10, label: "Outubro" }, { v: 11, label: "Novembro" }, { v: 12, label: "Dezembro" },
  ];
  const availableYears = [2026];

  const PeriodToolbar = (
    <div className="report-period-toolbar" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Período:</span>
      <select className="header-year" value={periodYear} onChange={e => setPeriodYear(Number(e.target.value))}>
        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <select className="header-year" value={periodMonth} onChange={e => setPeriodMonth(Number(e.target.value))}>
        {MONTH_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
    </div>
  );

  if (loading) {
    return (
      <div className="page">
        <div className="page-title">
          <div><h1>Relatório IA</h1><div className="status-line">Carregando…</div></div>
          <div className="actions">{PeriodToolbar}</div>
        </div>
      </div>
    );
  }

  if (generating) {
    return (
      <div className="page">
        <div className="page-title">
          <div>
            <h1>Relatório IA</h1>
            <div className="status-line">Gerando relatório com IA…</div>
          </div>
          <div className="actions">{PeriodToolbar}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚙️</div>
          <h2 className="card-title" style={{ textAlign: 'center' }}>Gerando análise…</h2>
          <p style={{ color: 'var(--fg-2)', lineHeight: 1.6, marginTop: 12 }}>
            Estamos disparando 7 chamadas à IA da Anthropic em paralelo para construir o relatório executivo deste período.
          </p>
          <p style={{ color: 'var(--fg-3)', fontSize: 13, marginTop: 8 }}>
            Geralmente leva ~30 segundos. Não feche esta página.
          </p>
          <div style={{ marginTop: 24, display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--cyan)', animation: 'pulse 1.4s ease-in-out infinite' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--cyan)', animation: 'pulse 1.4s ease-in-out 0.2s infinite' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--cyan)', animation: 'pulse 1.4s ease-in-out 0.4s infinite' }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !report) {
    const monthLabel = periodMonth > 0 ? MONTH_OPTIONS[periodMonth].label + ' de ' : '';
    return (
      <div className="page">
        <div className="page-title">
          <div>
            <h1>Relatório IA</h1>
            <div className="status-line">Relatório de {monthLabel}{periodYear} ainda não foi gerado</div>
          </div>
          <div className="actions">{PeriodToolbar}</div>
        </div>
        {availablePeriods.length > 0 && (
          <div className="card">
            <h2 className="card-title">Períodos disponíveis</h2>
            <p style={{ color: "var(--fg-2)", fontSize: 13, marginTop: 6, marginBottom: 14 }}>
              {availablePeriods.length} {availablePeriods.length === 1 ? 'relatório' : 'relatórios'} pré-{availablePeriods.length === 1 ? 'gerado' : 'gerados'} disponíveis. Clique pra abrir.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {availablePeriods.map((p, i) => (
                <button
                  key={i}
                  className="btn-ghost"
                  onClick={() => { setPeriodYear(p.year); setPeriodMonth(p.month); }}
                  style={{ padding: '8px 14px', borderRadius: 8 }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="card">
          <h2 className="card-title">Gerar este período localmente</h2>
          <p style={{ color: "var(--fg-2)", lineHeight: 1.6, marginTop: 12 }}>
            Os relatórios são gerados offline pelo script <code>_gen_reports.cjs</code> (engine Claude Code, sem API key). Pra gerar este período, abra um terminal na pasta do BI e rode:
          </p>
          <pre style={{ background: "var(--surface-2)", padding: 12, borderRadius: 8, marginTop: 12, fontSize: 13, color: "var(--cyan)" }}>
            {`cd C:/projects/<seu-bi>-bi-web\nNODE_OPTIONS="--use-system-ca" node _gen_reports.cjs`}
          </pre>
          <p style={{ color: "var(--fg-3)", fontSize: 12, marginTop: 12 }}>
            Depois de pronto, recarregue esta página (mantém o período selecionado).
          </p>
          {error && <p style={{ color: "var(--red)", fontSize: 12, marginTop: 8 }}>Detalhe: {error}</p>}
        </div>
      </div>
    );
  }

  const fmtDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const k = B.KPIS || B;
  const recebido = k.TOTAL_RECEITA || 0;
  const pago = k.TOTAL_DESPESA || 0;
  const liquido = k.VALOR_LIQUIDO != null ? k.VALOR_LIQUIDO : (recebido - pago);
  const margem = k.MARGEM_LIQUIDA != null ? k.MARGEM_LIQUIDA : (recebido > 0 ? (liquido / recebido) * 100 : 0);
  const aReceber = (Bprev.KPIS && Bprev.KPIS.TOTAL_RECEITA) || 0;
  const aPagar = (Bprev.KPIS && Bprev.KPIS.TOTAL_DESPESA) || 0;

  const sec = (id) => (report.secoes && report.secoes[id]) || { title: id, analysis: '' };

  const renderAnalysis = (text) => {
    if (!text) return <p className="report-analysis muted">(análise indisponível — verifique se a chamada à API foi bem-sucedida)</p>;
    return text.split(/\n\s*\n/).map((p, i) => (
      <p key={i} className="report-analysis">{p.trim()}</p>
    ));
  };

  // Computa lista de alerts e oportunidades baseado nos dados do BI
  const computeInsights = () => {
    const out = [];
    if (!B || !B.KPIS) return out;
    const rec = recebido || 0;
    const desp = pago || 0;
    const liq = liquido;
    const mg = margem;
    const recCats = B.RECEITA_CATEGORIAS || [];
    const despCats = B.DESPESA_CATEGORIAS || [];
    const recCli = B.RECEITA_CLIENTES || [];
    const despForn = B.DESPESA_FORNECEDORES || [];

    // Resultado positivo / negativo
    if (liq < 0) {
      out.push({ tone: "danger", icon: "⚠", title: "Resultado negativo no período",
        body: `Déficit de ${B.fmt(Math.abs(liq))} (margem ${mg.toFixed(1)}%). Sem ajuste estrutural ou capital adicional, esse padrão consome reserva de caixa rapidamente.` });
    } else if (mg > 15) {
      out.push({ tone: "success", icon: "✓", title: "Margem líquida saudável",
        body: `Margem de ${mg.toFixed(1)}% indica operação superavitária e espaço pra constituir reserva ou reinvestir.` });
    } else if (liq > 0 && mg < 5) {
      out.push({ tone: "warning", icon: "⚠", title: "Margem apertada",
        body: `Resultado positivo de ${B.fmt(liq)} mas margem de apenas ${mg.toFixed(1)}% — pequena variação no custo pode virar prejuízo.` });
    }

    // Concentração de fornecedor
    if (despForn[0] && desp > 0) {
      const top1f = despForn[0];
      const concF = (top1f.value / desp) * 100;
      if (concF > 50) {
        out.push({ tone: "danger", icon: "⚠", title: "Concentração crítica em fornecedor",
          body: `${top1f.name} representa ${concF.toFixed(0)}% (${B.fmt(top1f.value)}) das despesas — risco operacional alto. Recomenda-se mapear fornecedor alternativo qualificado.` });
      } else if (concF > 30) {
        out.push({ tone: "warning", icon: "⚠", title: "Atenção: concentração em fornecedor",
          body: `${top1f.name} responde por ${concF.toFixed(0)}% das despesas. Bom monitorar e iniciar conversa com fornecedor alternativo.` });
      }
    }

    // Concentração de cliente
    if (recCli[0] && rec > 0 && recCli[0].name !== 'Sem cliente') {
      const top1c = recCli[0];
      const concC = (top1c.value / rec) * 100;
      if (concC > 40) {
        out.push({ tone: "warning", icon: "⚠", title: "Concentração em cliente único",
          body: `${top1c.name} responde por ${concC.toFixed(0)}% da receita do período. Perda desse cliente impactaria o resultado significativamente.` });
      }
    }

    // CMV alto (categoria principal de despesa)
    if (despCats[0] && desp > 0 && /mercadoria|insumo|cmv/i.test(despCats[0].name) && rec > 0) {
      const cmvPctRec = (despCats[0].value / rec) * 100;
      if (cmvPctRec > 60) {
        out.push({ tone: "danger", icon: "⚠", title: "CMV elevado",
          body: `Custo de Mercadoria/Insumos representa ${cmvPctRec.toFixed(0)}% da receita — referência saudável é 50-55% no varejo, 30-45% em serviços. Avaliar renegociação ou repasse de preço.` });
      }
    }

    // Descasamento caixa (a pagar > a receber)
    if (aPagar > 0 && aReceber > 0) {
      const diff = aReceber - aPagar;
      if (diff < 0 && Math.abs(diff) > rec * 0.1) {
        out.push({ tone: "warning", icon: "⚠", title: "Descasamento de caixa",
          body: `A pagar (${B.fmt(aPagar)}) supera a receber (${B.fmt(aReceber)}) em ${B.fmt(Math.abs(diff))}. Requer atenção pra fluxo nas próximas semanas.` });
      } else if (diff > 0 && diff > rec * 0.1) {
        out.push({ tone: "success", icon: "✓", title: "Geração de caixa futuro",
          body: `Pendências a receber (${B.fmt(aReceber)}) superam a pagar (${B.fmt(aPagar)}) em ${B.fmt(diff)} — capital de giro positivo se tudo realizar.` });
      }
    }

    // Granularidade do plano de contas
    if (recCats.length === 1 && /^receitas?$/i.test(recCats[0].name)) {
      out.push({ tone: "warning", icon: "💡", title: "Plano de contas pouco granular",
        body: `Toda receita está concentrada numa única categoria "Receita". Segmentar por canal/produto no fin40 destravaria análise ABC e mix de margem neste BI.` });
    }

    return out;
  };

  const renderInsightBoxes = () => {
    const insights = computeInsights();
    if (insights.length === 0) return null;
    return (
      <section className="report-section report-insights">
        <h2>Insights & Alertas</h2>
        <div className="insight-grid">
          {insights.map((ins, i) => (
            <div key={i} className={`insight-box insight-${ins.tone}`}>
              <div className="insight-head">
                <span className="insight-icon">{ins.icon}</span>
                <span className="insight-title">{ins.title}</span>
              </div>
              <div className="insight-body">{ins.body}</div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="page">
      {/* Toolbar — escondida no print */}
      <div className="report-toolbar no-print">
        <div>
          <h1 style={{ margin: 0 }}>Relatório IA</h1>
          <div className="status-line">Gerado em {fmtDate(report.generated_at)} · {report.periodo}</div>
        </div>
        <div className="actions" style={{ gap: 12, alignItems: 'center' }}>
          {PeriodToolbar}
          <button className="btn-primary" onClick={() => window.print()}>
            <Icon name="download" /> Exportar PDF
          </button>
        </div>
      </div>

      {/* Modal de ajuda */}
      {showHelp && (
        <div className="drawer-overlay no-print" onClick={() => setShowHelp(false)}>
          <div className="card" style={{ maxWidth: 520, margin: "auto", padding: 24 }} onClick={e => e.stopPropagation()}>
            <h2 className="card-title">Como regenerar o relatório</h2>
            <p style={{ color: "var(--fg-2)", lineHeight: 1.6, marginTop: 8 }}>
              O relatório é gerado offline por um script Node que chama a API da Anthropic.
              Não pode ser disparado pelo browser (a chave da API ficaria exposta).
            </p>
            <p style={{ color: "var(--fg-2)", lineHeight: 1.6, marginTop: 12 }}>No terminal, dentro da pasta do projeto:</p>
            <pre style={{ background: "var(--surface-2)", padding: 12, borderRadius: 8, marginTop: 8, fontSize: 13, color: "var(--cyan)" }}>
node generate-report.cjs --force
            </pre>
            <p style={{ color: "var(--fg-3)", fontSize: 12, marginTop: 12 }}>
              Depois recarregue esta página. Sem <code>--force</code>, o script pula se o relatório foi gerado há menos de 1h.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn-primary" onClick={() => setShowHelp(false)}>Entendi</button>
            </div>
          </div>
        </div>
      )}

      {/* Relatorio imprimivel */}
      <article className="report">
        <header className="report-cover">
          <img src="assets/bgp-logo-white.png" alt="BGP" className="report-logo" />
          <h1 className="report-title">BGP GO BI — Relatório Executivo</h1>
          <p className="report-subtitle">{report.empresa}</p>
          <p className="report-meta">Período: {report.periodo} — Realizado</p>
          <p className="report-meta">Gerado em {fmtDate(report.generated_at)}</p>
        </header>

        {renderInsightBoxes()}

        <section className="report-section">
          <h2>1. Visão Geral</h2>
          <div className="report-kpis">
            <div className="report-kpi"><span className="lbl">Receita realizada</span><span className="val green">{B.fmt(recebido)}</span></div>
            <div className="report-kpi"><span className="lbl">Despesa realizada</span><span className="val red">{B.fmt(pago)}</span></div>
            <div className="report-kpi"><span className="lbl">Resultado líquido</span><span className="val" style={{ color: liquido >= 0 ? "var(--green)" : "var(--red)" }}>{B.fmt(liquido)}</span></div>
            <div className="report-kpi"><span className="lbl">Margem líquida</span><span className="val">{B.fmtPct ? B.fmtPct(margem) : margem.toFixed(2) + "%"}</span></div>
          </div>
          {renderAnalysis(sec('visao_geral').analysis)}
        </section>

        <section className="report-section">
          <h2>2. Receita</h2>
          <div className="report-kpis">
            <div className="report-kpi"><span className="lbl">Receita recebida</span><span className="val green">{B.fmt(recebido)}</span></div>
            <div className="report-kpi"><span className="lbl">Receita a receber</span><span className="val">{B.fmt(aReceber)}</span></div>
          </div>
          {(() => {
            const cats = B.RECEITA_CATEGORIAS || [];
            const total = cats.reduce((s, c) => s + c.value, 0) || 1;
            return (
              <>
                <h3 className="report-sub">Top 10 categorias</h3>
                <ul className="report-list">
                  {cats.slice(0, 10).map((c, i) => (
                    <li key={i}>
                      <span>{c.name}</span>
                      <b>{B.fmt(c.value)} <small style={{ color: "var(--mute)", fontWeight: 400 }}>({((c.value / total) * 100).toFixed(1)}%)</small></b>
                    </li>
                  ))}
                </ul>
              </>
            );
          })()}
          {(() => {
            const cli = (B.RECEITA_CLIENTES || []).filter(c => c.name !== 'Sem cliente');
            if (cli.length === 0) return null;
            const totalCli = cli.reduce((s, c) => s + c.value, 0) || 1;
            return (
              <>
                <h3 className="report-sub" style={{ marginTop: 16 }}>Top 5 clientes</h3>
                <ul className="report-list">
                  {cli.slice(0, 5).map((c, i) => (
                    <li key={i}>
                      <span>{c.name}</span>
                      <b>{B.fmt(c.value)} <small style={{ color: "var(--mute)", fontWeight: 400 }}>({((c.value / totalCli) * 100).toFixed(1)}%)</small></b>
                    </li>
                  ))}
                </ul>
              </>
            );
          })()}
          {renderAnalysis(sec('receita').analysis)}
        </section>

        <section className="report-section">
          <h2>3. Despesa</h2>
          <div className="report-kpis">
            <div className="report-kpi"><span className="lbl">Despesa paga</span><span className="val red">{B.fmt(pago)}</span></div>
            <div className="report-kpi"><span className="lbl">Despesa a pagar</span><span className="val">{B.fmt(aPagar)}</span></div>
          </div>
          {(() => {
            const cats = B.DESPESA_CATEGORIAS || [];
            const total = cats.reduce((s, c) => s + c.value, 0) || 1;
            return (
              <>
                <h3 className="report-sub">Top 10 categorias</h3>
                <ul className="report-list">
                  {cats.slice(0, 10).map((c, i) => (
                    <li key={i}>
                      <span>{c.name}</span>
                      <b>{B.fmt(c.value)} <small style={{ color: "var(--mute)", fontWeight: 400 }}>({((c.value / total) * 100).toFixed(1)}%)</small></b>
                    </li>
                  ))}
                </ul>
              </>
            );
          })()}
          {(() => {
            const forn = B.DESPESA_FORNECEDORES || [];
            if (forn.length === 0) return null;
            const totalForn = forn.reduce((s, f) => s + f.value, 0) || 1;
            return (
              <>
                <h3 className="report-sub" style={{ marginTop: 16 }}>Top 5 fornecedores</h3>
                <ul className="report-list">
                  {forn.slice(0, 5).map((f, i) => (
                    <li key={i}>
                      <span>{f.name}</span>
                      <b>{B.fmt(f.value)} <small style={{ color: "var(--mute)", fontWeight: 400 }}>({((f.value / totalForn) * 100).toFixed(1)}%)</small></b>
                    </li>
                  ))}
                </ul>
              </>
            );
          })()}
          {renderAnalysis(sec('despesa').analysis)}
        </section>

        <section className="report-section">
          <h2>4. Fluxo de Caixa</h2>
          <div className="report-kpis">
            <div className="report-kpi"><span className="lbl">Receita total</span><span className="val green">{B.fmt(recebido)}</span></div>
            <div className="report-kpi"><span className="lbl">Despesa total</span><span className="val red">{B.fmt(pago)}</span></div>
            <div className="report-kpi"><span className="lbl">Líquido</span><span className="val" style={{ color: liquido >= 0 ? "var(--green)" : "var(--red)" }}>{B.fmt(liquido)}</span></div>
          </div>
          <h3 className="report-sub">Líquido mês a mês</h3>
          <ul className="report-list">
            {(B.MONTH_DATA || []).map((m, i) => {
              const v = m.receita - m.despesa;
              return <li key={i}><span style={{ textTransform: "capitalize" }}>{m.m}</span><b style={{ color: v >= 0 ? "var(--green)" : "var(--red)" }}>{B.fmt(v)}</b></li>;
            })}
          </ul>
          {renderAnalysis(sec('fluxo_caixa').analysis)}
        </section>

        <section className="report-section">
          <h2>5. Tesouraria</h2>
          <div className="report-kpis">
            <div className="report-kpi"><span className="lbl">Recebido</span><span className="val green">{B.fmt(recebido)}</span></div>
            <div className="report-kpi"><span className="lbl">A receber</span><span className="val">{B.fmt(aReceber)}</span></div>
            <div className="report-kpi"><span className="lbl">Pago</span><span className="val red">{B.fmt(pago)}</span></div>
            <div className="report-kpi"><span className="lbl">A pagar</span><span className="val">{B.fmt(aPagar)}</span></div>
          </div>
          {renderAnalysis(sec('tesouraria').analysis)}
        </section>

        <section className="report-section">
          <h2>6. Comparativo</h2>
          <p style={{ color: "var(--fg-2)", lineHeight: 1.6, marginBottom: 16, fontSize: 13 }}>
            Análise comparativa do desempenho mês a mês. Identifica picos, vales e tendências de receita, despesa e resultado líquido ao longo do período.
          </p>

          {/* KPIs comparativos */}
          {(() => {
            const md = (B.MONTH_DATA || []).filter(m => (m.receita || 0) > 0 || (m.despesa || 0) > 0);
            if (md.length === 0) return null;
            const withLiq = md.map(m => ({ ...m, liq: (m.receita || 0) - (m.despesa || 0), margem: (m.receita || 0) > 0 ? (((m.receita || 0) - (m.despesa || 0)) / (m.receita || 0)) * 100 : 0 }));
            const melhorReceita = withLiq.reduce((a, b) => (b.receita > a.receita ? b : a));
            const piorMargem = withLiq.reduce((a, b) => (b.margem < a.margem ? b : a));
            const melhorMargem = withLiq.reduce((a, b) => (b.margem > a.margem ? b : a));
            const ultimoMes = withLiq[withLiq.length - 1];
            const penultMes = withLiq.length > 1 ? withLiq[withLiq.length - 2] : null;
            const varReceitaMoM = penultMes && penultMes.receita > 0 ? ((ultimoMes.receita - penultMes.receita) / penultMes.receita) * 100 : 0;
            const varDespMoM = penultMes && penultMes.despesa > 0 ? ((ultimoMes.despesa - penultMes.despesa) / penultMes.despesa) * 100 : 0;
            const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
            return (
              <div className="report-kpis" style={{ marginBottom: 16 }}>
                <div className="report-kpi"><span className="lbl">Melhor receita</span><span className="val green">{B.fmt(melhorReceita.receita)}</span><span style={{ fontSize: 11, color: "var(--mute)" }}>{cap(melhorReceita.m)}</span></div>
                <div className="report-kpi"><span className="lbl">Melhor margem</span><span className="val">{melhorMargem.margem.toFixed(1)}%</span><span style={{ fontSize: 11, color: "var(--mute)" }}>{cap(melhorMargem.m)}</span></div>
                <div className="report-kpi"><span className="lbl">Pior margem</span><span className="val" style={{ color: "var(--red)" }}>{piorMargem.margem.toFixed(1)}%</span><span style={{ fontSize: 11, color: "var(--mute)" }}>{cap(piorMargem.m)}</span></div>
                {penultMes && (
                  <div className="report-kpi">
                    <span className="lbl">Receita {cap(ultimoMes.m)} vs {cap(penultMes.m)}</span>
                    <span className="val" style={{ color: varReceitaMoM >= 0 ? "var(--green)" : "var(--red)" }}>{varReceitaMoM >= 0 ? "+" : ""}{varReceitaMoM.toFixed(1)}%</span>
                  </div>
                )}
                {penultMes && (
                  <div className="report-kpi">
                    <span className="lbl">Despesa {cap(ultimoMes.m)} vs {cap(penultMes.m)}</span>
                    <span className="val" style={{ color: varDespMoM <= 0 ? "var(--green)" : "var(--red)" }}>{varDespMoM >= 0 ? "+" : ""}{varDespMoM.toFixed(1)}%</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Tabela mês a mês com variação MoM */}
          <h3 className="report-sub" style={{ marginTop: 8 }}>Evolução mês a mês</h3>
          <table className="t" style={{ width: "100%", marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Mês</th>
                <th className="num">Receita</th>
                <th className="num">Despesa</th>
                <th className="num">Líquido</th>
                <th className="num">Margem</th>
                <th className="num">Δ Receita MoM</th>
              </tr>
            </thead>
            <tbody>
              {(B.MONTH_DATA || []).map((m, i) => {
                const rec = m.receita || 0;
                const desp = m.despesa || 0;
                if (rec === 0 && desp === 0) return null;
                const liq = rec - desp;
                const margem = rec > 0 ? (liq / rec) * 100 : 0;
                const prev = i > 0 ? (B.MONTH_DATA[i - 1] || {}) : null;
                const prevRec = prev && (prev.receita || 0);
                const varMoM = prevRec > 0 ? ((rec - prevRec) / prevRec) * 100 : null;
                const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
                return (
                  <tr key={i}>
                    <td>{cap(m.m)}</td>
                    <td className="num green">{B.fmt(rec)}</td>
                    <td className="num red">{B.fmt(desp)}</td>
                    <td className="num" style={{ color: liq >= 0 ? "var(--green)" : "var(--red)" }}>{B.fmt(liq)}</td>
                    <td className="num">{margem.toFixed(1)}%</td>
                    <td className="num" style={{ color: varMoM == null ? "var(--mute)" : (varMoM >= 0 ? "var(--green)" : "var(--red)") }}>
                      {varMoM == null ? "—" : (varMoM >= 0 ? "+" : "") + varMoM.toFixed(1) + "%"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Análise textual da IA — preservada */}
          {sec('comparativo').analysis && (
            <div style={{ marginTop: 16 }}>
              <h3 className="report-sub">Análise</h3>
              {renderAnalysis(sec('comparativo').analysis)}
            </div>
          )}
        </section>

        <section className="report-section report-conclusion">
          <h2>Conclusão e Recomendações</h2>
          {renderAnalysis(report.conclusao)}
        </section>

        <footer className="report-footer">
          BGP GO BI · {report.empresa} · {report.periodo} · Gerado em {fmtDate(report.generated_at)}
        </footer>
      </article>
    </div>
  );
};

Object.assign(window, { PageFluxo, PageTesouraria, PageComparativo, PageRelatorio });
