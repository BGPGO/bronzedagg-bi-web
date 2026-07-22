/**
 * pages-5.jsx — Paginas customizadas Bronze da GG
 *
 * PageDRE: DRE completo com rateio DNA
 * PageFaturamentoTrinks: Faturamento por serviço/produto/pacote/unidade
 * PageLojas: Ranking e comparativo entre unidades
 */

// =========================================================================
// PAGE DRE — Demonstração de Resultado com DNA Rateado
// =========================================================================
const PageDRE = function(props) {
  var statusFilter = props.statusFilter;
  var drilldown = props.drilldown;
  var setDrilldown = props.setDrilldown;
  var year = props.year;
  var months = props.months;
  var B = useMemo(function() { return window.getBit(statusFilter, drilldown, year, months); }, [statusFilter, drilldown, year, months]);
  var fmt = (B && B.fmt) || window.BIT.fmt;
  var fmtK = (B && B.fmtK) || window.BIT.fmtK;

  // Pegar categorias do config para classificar
  var catOverrides = (window.BIT_META && window.BIT_META.categoria_overrides) || {};

  // Classificar movimentos por tipo de categoria
  const dreData = useMemo(() => {
    const allTx = window.ALL_TX || [];
    let filtered = allTx;

    // Aplicar filtro de status
    if (statusFilter === 'realizado') filtered = filtered.filter(r => r[6] === 1);
    else if (statusFilter === 'a_pagar_receber') filtered = filtered.filter(r => r[6] === 0);

    // Aplicar filtro de unidade (via drilldown)
    if (drilldown && drilldown.type === 'unidade') {
      filtered = filtered.filter(r => r[8] === drilldown.value);
    }

    // Aplicar filtro de ano
    const y = String(year);
    filtered = filtered.filter(r => r[1] && r[1].startsWith(y));

    // Aplicar filtro de meses
    if (months && months.length > 0) {
      const monthSet = new Set(months.map(m => y + '-' + String(m).padStart(2, '0')));
      filtered = filtered.filter(r => monthSet.has(r[1]));
    }

    // Agregar por tipo
    const byType = { receita: 0, deducao: 0, imposto: 0, custo: 0, despesa: 0, dna: 0, investimento: 0, financeiro: 0, transferencia: 0, outros: 0 };
    const catDetail = {};
    const byMonth = {};

    for (const row of filtered) {
      const [kind, mes, dia, categoria, cliente, valor, realizado, fornecedor, cc] = row;
      const catType = catOverrides[categoria] || (kind === 'r' ? 'receita' : 'despesa');

      if (catType === 'transferencia') continue;

      const sign = kind === 'r' ? 1 : -1;
      const v = valor * sign;

      if (catType === 'receita') byType.receita += valor;
      else if (catType === 'deducao') byType.deducao += valor;
      else if (catType === 'imposto') byType.imposto += valor;
      else if (catType === 'custo') byType.custo += valor;
      else if (catType === 'despesa') byType.despesa += valor;
      else if (catType === 'dna') byType.dna += valor;
      else if (catType === 'investimento') byType.investimento += valor;
      else if (catType === 'financeiro') byType.financeiro += valor;
      else byType.outros += valor;

      // Detalhe por categoria
      if (catType !== 'transferencia') {
        if (!catDetail[catType]) catDetail[catType] = {};
        catDetail[catType][categoria] = (catDetail[catType][categoria] || 0) + valor;
      }

      // Por mês
      if (mes) {
        if (!byMonth[mes]) byMonth[mes] = { receita: 0, deducao: 0, imposto: 0, custo: 0, despesa: 0, dna: 0, investimento: 0, financeiro: 0 };
        if (byType[catType] !== undefined && catType !== 'transferencia' && catType !== 'outros') {
          byMonth[mes][catType] = (byMonth[mes][catType] || 0) + valor;
        }
      }
    }

    // Calcular DRE
    const fatBruto = byType.receita;
    const deducoes = byType.deducao + byType.imposto;
    const receitaLiq = fatBruto - deducoes;
    const custos = byType.custo;
    const lucroBruto = receitaLiq - custos;
    const despOp = byType.despesa;
    const lucroPre = lucroBruto - despOp;
    const dna = byType.dna;
    const resultadoUnidade = lucroPre - dna;
    const investimentos = byType.investimento;
    const financeiro = byType.financeiro;
    const resultadoFinal = resultadoUnidade - investimentos - financeiro;

    // Montar linhas do DRE
    const dreLines = [
      { label: 'FATURAMENTO COMERCIAL', value: fatBruto, bold: true, level: 0 },
      { label: '(-) Descontos / Deduções', value: -byType.deducao, level: 1, color: 'red' },
      { label: '(-) Impostos', value: -byType.imposto, level: 1, color: 'red' },
      { label: '= RECEITA LÍQUIDA', value: receitaLiq, bold: true, level: 0, highlight: true },
      { label: '(-) Custos Operacionais (CSP/CMV)', value: -custos, level: 1, color: 'red' },
      { label: '= LUCRO BRUTO', value: lucroBruto, bold: true, level: 0, highlight: true },
      { label: '(-) Despesas Operacionais', value: -despOp, level: 1, color: 'red' },
      { label: '= RESULTADO PRÉ-DNA', value: lucroPre, bold: true, level: 0, highlight: true },
      { label: '(-) Rateio DNA / G&A', value: -dna, level: 1, color: 'amber' },
      { label: '= RESULTADO DA UNIDADE', value: resultadoUnidade, bold: true, level: 0, highlight: true, tone: resultadoUnidade >= 0 ? 'green' : 'red' },
      { label: '(-) Investimentos (CAPEX)', value: -investimentos, level: 1 },
      { label: '(-) Financeiro', value: -financeiro, level: 1 },
      { label: '= RESULTADO FINAL', value: resultadoFinal, bold: true, level: 0, highlight: true, tone: resultadoFinal >= 0 ? 'green' : 'red' },
    ];

    // Margem
    const margemBruta = fatBruto > 0 ? (lucroBruto / fatBruto * 100) : 0;
    const margemLiq = fatBruto > 0 ? (resultadoFinal / fatBruto * 100) : 0;
    const margemOp = fatBruto > 0 ? (lucroPre / fatBruto * 100) : 0;

    // DRE mensal
    const monthKeys = Object.keys(byMonth).sort();
    const dreMonthly = monthKeys.map(m => {
      const d = byMonth[m];
      const rec = d.receita || 0;
      const ded = (d.deducao || 0) + (d.imposto || 0);
      const cst = d.custo || 0;
      const dsp = d.despesa || 0;
      const dn = d.dna || 0;
      const recLiq = rec - ded;
      const lBruto = recLiq - cst;
      const lPre = lBruto - dsp;
      const res = lPre - dn;
      return { mes: m, receita: rec, deducoes: ded, receitaLiq: recLiq, custos: cst, lucroBruto: lBruto, despesas: dsp, lucroPre: lPre, dna: dn, resultado: res };
    });

    return { dreLines, catDetail, dreMonthly, margemBruta, margemLiq, margemOp, fatBruto, receitaLiq, lucroBruto, lucroPre, resultadoUnidade, resultadoFinal };
  }, [statusFilter, drilldown, year, months]);

  const [expandedType, setExpandedType] = useState(null);

  const MONTHS_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>DRE — Demonstração de Resultado</h1>
          <div className="status-line">{drilldown && drilldown.type === 'unidade' ? drilldown.value : 'Consolidado'} · {year}</div>
        </div>
      </div>
      <DrilldownBadge drilldown={drilldown} onClear={() => setDrilldown(null)} />

      {/* KPI Tiles */}
      <div className="row row-4">
        <KpiTile label="Faturamento" value={fmtK(dreData.fatBruto)} tone="cyan" />
        <KpiTile label="Margem Bruta" value={dreData.margemBruta.toFixed(1) + '%'} tone={dreData.margemBruta >= 0 ? 'green' : 'red'} />
        <KpiTile label="Margem Operacional" value={dreData.margemOp.toFixed(1) + '%'} tone={dreData.margemOp >= 0 ? 'green' : 'red'} />
        <KpiTile label="Resultado Final" value={fmtK(dreData.resultadoFinal)} tone={dreData.resultadoFinal >= 0 ? 'green' : 'red'} />
      </div>

      {/* DRE Table */}
      <div className="card" style={{ padding: '24px' }}>
        <h2 className="card-title">Estrutura DRE</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', color: '#fff' }}>
          <tbody>
            {dreData.dreLines.map((line, i) => {
              const typeKey = line.label.includes('Deduções') ? 'deducao' : line.label.includes('Impostos') ? 'imposto' : line.label.includes('Custos') ? 'custo' : line.label.includes('Despesas Operacionais') ? 'despesa' : line.label.includes('DNA') ? 'dna' : line.label.includes('Investimentos') ? 'investimento' : line.label.includes('Financeiro') && !line.bold ? 'financeiro' : null;
              const isExpandable = typeKey && dreData.catDetail[typeKey] && Object.keys(dreData.catDetail[typeKey]).length > 0;
              const isExpanded = expandedType === typeKey;
              const labelColor = line.tone === 'green' ? '#10b981' : line.tone === 'red' ? '#ef4444' : '#fff';
              const valColor = line.value < 0 ? '#ef4444' : labelColor;

              return (
                <React.Fragment key={"dre-"+i}>
                  <tr
                    style={{
                      borderBottom: line.highlight ? '2px solid #243038' : '1px solid #1a242a',
                      background: line.highlight ? '#11181d' : 'transparent',
                      cursor: isExpandable ? 'pointer' : 'default',
                    }}
                    onClick={() => isExpandable && setExpandedType(isExpanded ? null : typeKey)}
                  >
                    <td style={{ padding: '10px 12px', paddingLeft: (line.level * 24 + 12) + 'px', fontWeight: line.bold ? 700 : 400, color: labelColor }}>
                      {isExpandable && <span style={{ marginRight: 8, fontSize: 10, color: '#6b7680' }}>{isExpanded ? '▼' : '▶'}</span>}
                      {line.label}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: line.bold ? 700 : 400, color: valColor, fontFamily: 'var(--font-mono, monospace)' }}>
                      {fmt(line.value)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#b8c2c8', fontSize: 12 }}>
                      {dreData.fatBruto > 0 ? (line.value / dreData.fatBruto * 100).toFixed(1) + '%' : '—'}
                    </td>
                  </tr>
                  {isExpanded && Object.entries(dreData.catDetail[typeKey]).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                    <tr key={cat} style={{ borderBottom: '1px solid #1a242a', background: '#0d1216' }}>
                      <td style={{ padding: '6px 12px', paddingLeft: '60px', fontSize: 13, color: '#b8c2c8' }}>{cat}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'right', fontSize: 13, color: '#fff', fontFamily: 'var(--font-mono, monospace)' }}>{fmt(val)}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'right', fontSize: 11, color: '#b8c2c8' }}>
                        {dreData.fatBruto > 0 ? (val / dreData.fatBruto * 100).toFixed(1) + '%' : '—'}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* DRE Mensal */}
      {dreData.dreMonthly.length > 0 && (
        <div className="card" style={{ padding: '24px', overflowX: 'auto' }}>
          <h2 className="card-title">DRE Mensal</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: 800, color: '#fff' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #243038' }}>
                <th style={{ padding: '8px', textAlign: 'left', color: '#b8c2c8' }}>Linha</th>
                {dreData.dreMonthly.map(d => (
                  <th key={d.mes} style={{ padding: '8px', textAlign: 'right', minWidth: 80, color: '#b8c2c8' }}>
                    {MONTHS_LABEL[parseInt(d.mes.slice(5, 7), 10) - 1]}
                  </th>
                ))}
                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: '#b8c2c8' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {[
                { key: 'receita', label: 'Faturamento', bold: true },
                { key: 'deducoes', label: '(-) Deduções' },
                { key: 'receitaLiq', label: 'Receita Líquida', bold: true },
                { key: 'custos', label: '(-) Custos' },
                { key: 'lucroBruto', label: 'Lucro Bruto', bold: true },
                { key: 'despesas', label: '(-) Despesas Op.' },
                { key: 'lucroPre', label: 'Resultado Pré-DNA', bold: true },
                { key: 'dna', label: '(-) DNA/G&A' },
                { key: 'resultado', label: 'Resultado', bold: true },
              ].map(line => (
                <tr key={line.key} style={{ borderBottom: line.bold ? '2px solid #243038' : '1px solid #1a242a' }}>
                  <td style={{ padding: '8px', fontWeight: line.bold ? 700 : 400, color: '#fff' }}>{line.label}</td>
                  {dreData.dreMonthly.map(d => {
                    const v = d[line.key] || 0;
                    const neg = line.key !== 'receita' && line.key !== 'receitaLiq' && line.key !== 'lucroBruto' && line.key !== 'lucroPre' && line.key !== 'resultado';
                    return (
                      <td key={d.mes} style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', fontWeight: line.bold ? 700 : 400, color: line.key === 'resultado' ? (v >= 0 ? '#10b981' : '#ef4444') : '#fff' }}>
                        {fmtK(neg ? -v : v)}
                      </td>
                    );
                  })}
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: '#fff' }}>
                    {fmtK(dreData.dreMonthly.reduce((s, d) => s + (d[line.key] || 0), 0) * (line.key !== 'receita' && line.key !== 'receitaLiq' && line.key !== 'lucroBruto' && line.key !== 'lucroPre' && line.key !== 'resultado' ? -1 : 1))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};


// =========================================================================
// PAGE FATURAMENTO TRINKS — Visão do faturamento por serviço/produto/unidade
// =========================================================================
const PageFaturamentoTrinks = ({ statusFilter, drilldown, setDrilldown, year, months, unidade }) => {
  const B = useMemo(() => window.getBit(statusFilter, drilldown, year, months), [statusFilter, drilldown, year, months]);
  const fmt = B.fmt || window.BIT.fmt;
  const fmtK = B.fmtK || window.BIT.fmtK;

  const fatData = useMemo(() => {
    const allTx = window.ALL_TX || [];
    let filtered = allTx.filter(r => r[0] === 'r'); // só receitas

    if (statusFilter === 'realizado') filtered = filtered.filter(r => r[6] === 1);
    else if (statusFilter === 'a_pagar_receber') filtered = filtered.filter(r => r[6] === 0);

    if (drilldown && drilldown.type === 'unidade') {
      filtered = filtered.filter(r => r[8] === drilldown.value);
    }

    const y = String(year);
    filtered = filtered.filter(r => r[1] && r[1].startsWith(y));

    if (months && months.length > 0) {
      const monthSet = new Set(months.map(m => y + '-' + String(m).padStart(2, '0')));
      filtered = filtered.filter(r => monthSet.has(r[1]));
    }

    // Categorias de faturamento
    const fatCats = ['1.1. Serviços de Bronze', '1.2. Produtos', '1.2.1. Produtos Franquias', '1.3. Sublocação', '1.5. Taxa Representação', '1.6. Royalties Franquia', '1.7. Taxa de Marketing', '1.9. Café', '1.10. Vendas TikTok', '1.11. Taxa de Franquia'];
    const fatFiltered = filtered.filter(r => fatCats.includes(r[3]));

    // Por categoria
    const byCat = {};
    for (const r of fatFiltered) {
      const cat = r[3];
      byCat[cat] = (byCat[cat] || 0) + r[5];
    }

    // Por unidade
    const byUnit = {};
    for (const r of fatFiltered) {
      const u = r[8] || 'Sem unidade';
      byUnit[u] = (byUnit[u] || 0) + r[5];
    }

    // Por mês
    const byMonth = {};
    for (const r of fatFiltered) {
      const m = r[1];
      if (!byMonth[m]) byMonth[m] = { servicos: 0, produtos: 0, outros: 0, total: 0 };
      if (r[3] === '1.1. Serviços de Bronze') byMonth[m].servicos += r[5];
      else if (r[3].startsWith('1.2')) byMonth[m].produtos += r[5];
      else byMonth[m].outros += r[5];
      byMonth[m].total += r[5];
    }

    // Descontos (do Trinks)
    const descFiltered = allTx.filter(r => r[0] === 'd' && r[3] === 'Descontos Trinks');
    let descontos = 0;
    for (const r of descFiltered) {
      if (statusFilter === 'realizado' && r[6] !== 1) continue;
      if (statusFilter === 'a_pagar_receber' && r[6] !== 0) continue;
      if (!r[1] || !r[1].startsWith(y)) continue;
      if (drilldown && drilldown.type === 'unidade' && r[8] !== drilldown.value) continue;
      if (months && months.length > 0) {
        const monthSet = new Set(months.map(m => y + '-' + String(m).padStart(2, '0')));
        if (!monthSet.has(r[1])) continue;
      }
      descontos += r[5];
    }

    const totalFat = Object.values(byCat).reduce((s, v) => s + v, 0);
    const receitaBruta = totalFat - descontos;

    return { byCat, byUnit, byMonth, descontos, totalFat, receitaBruta };
  }, [statusFilter, drilldown, year, months]);

  const MONTHS_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  const catItems = Object.entries(fatData.byCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const unitItems = Object.entries(fatData.byUnit).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const monthKeys = Object.keys(fatData.byMonth).sort();

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Faturamento — Trinks</h1>
          <div className="status-line">{drilldown && drilldown.type === 'unidade' ? drilldown.value : 'Todas unidades'} · {year}</div>
        </div>
      </div>
      <DrilldownBadge drilldown={drilldown} onClear={() => setDrilldown(null)} />

      {/* KPIs */}
      <div className="row row-4">
        <KpiTile label="Fat. Comercial" value={fmtK(fatData.totalFat)} tone="cyan" />
        <KpiTile label="Descontos" value={fmtK(-fatData.descontos)} tone="red" />
        <KpiTile label="Receita Bruta" value={fmtK(fatData.receitaBruta)} tone="green" />
        <KpiTile label="% Desconto" value={fatData.totalFat > 0 ? (fatData.descontos / fatData.totalFat * 100).toFixed(1) + '%' : '0%'} tone="amber" />
      </div>

      {/* Fat por Categoria e por Unidade lado a lado */}
      <div className="row">
        <div className="card" style={{ flex: 1 }}>
          <h2 className="card-title">Por Tipo de Receita</h2>
          <BarList items={catItems} color="green" onItemClick={(it) => setDrilldown({ type: 'categoria', value: it.name, label: it.name })} activeName={drilldown && drilldown.type === 'categoria' ? drilldown.value : null} />
        </div>
        <div className="card" style={{ flex: 1 }}>
          <h2 className="card-title">Por Unidade</h2>
          <BarList items={unitItems} color="cyan" onItemClick={(it) => setDrilldown({ type: 'unidade', value: it.name, label: it.name })} activeName={drilldown && drilldown.type === 'unidade' ? drilldown.value : null} />
        </div>
      </div>

      {/* Fat mensal */}
      {monthKeys.length > 0 && (
        <div className="card" style={{ padding: '24px', overflowX: 'auto' }}>
          <h2 className="card-title">Faturamento Mensal — Serviços × Produtos</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: 600, color: '#fff' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #243038' }}>
                <th style={{ padding: '8px', textAlign: 'left' }}>Mês</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Serviços</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Produtos</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Outros</th>
                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {monthKeys.map(m => {
                const d = fatData.byMonth[m];
                const mIdx = parseInt(m.slice(5, 7), 10) - 1;
                return (
                  <tr key={m} style={{ borderBottom: '1px solid #1a242a' }}>
                    <td style={{ padding: '8px' }}>{MONTHS_LABEL[mIdx]}/{m.slice(0, 4)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }}>{fmtK(d.servicos)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }}>{fmtK(d.produtos)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }}>{fmtK(d.outros)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', fontWeight: 700 }}>{fmtK(d.total)}</td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: '2px solid #243038' }}>
                <td style={{ padding: '8px', fontWeight: 700 }}>Total</td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}>{fmtK(monthKeys.reduce((s, m) => s + fatData.byMonth[m].servicos, 0))}</td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}>{fmtK(monthKeys.reduce((s, m) => s + fatData.byMonth[m].produtos, 0))}</td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}>{fmtK(monthKeys.reduce((s, m) => s + fatData.byMonth[m].outros, 0))}</td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}>{fmtK(fatData.totalFat)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};


// =========================================================================
// PAGE LOJAS — Ranking e comparativo entre unidades
// =========================================================================
const PageLojas = ({ statusFilter, drilldown, setDrilldown, year, months }) => {
  const B = useMemo(() => window.getBit(statusFilter, null, year, months), [statusFilter, year, months]);
  const fmt = B.fmt || window.BIT.fmt;
  const fmtK = B.fmtK || window.BIT.fmtK;

  const unitsData = useMemo(() => {
    const allTx = window.ALL_TX || [];
    let filtered = allTx;

    if (statusFilter === 'realizado') filtered = filtered.filter(r => r[6] === 1);
    else if (statusFilter === 'a_pagar_receber') filtered = filtered.filter(r => r[6] === 0);

    const y = String(year);
    filtered = filtered.filter(r => r[1] && r[1].startsWith(y));

    if (months && months.length > 0) {
      const monthSet = new Set(months.map(m => y + '-' + String(m).padStart(2, '0')));
      filtered = filtered.filter(r => monthSet.has(r[1]));
    }

    const catOverrides = (window.BIT_META && window.BIT_META.categoria_overrides) || {};

    // Agregar por unidade
    const units = {};
    for (const r of filtered) {
      const [kind, mes, dia, categoria, cliente, valor, realizado, fornecedor, cc] = r;
      const u = cc || 'Sem unidade';
      const catType = catOverrides[categoria] || (kind === 'r' ? 'receita' : 'despesa');
      if (catType === 'transferencia') continue;

      if (!units[u]) units[u] = { receita: 0, despesa: 0, dna: 0, custo: 0, imposto: 0 };
      if (kind === 'r') units[u].receita += valor;
      else {
        units[u].despesa += valor;
        if (catType === 'dna') units[u].dna += valor;
        if (catType === 'custo') units[u].custo += valor;
        if (catType === 'imposto') units[u].imposto += valor;
      }
    }

    // Calcular resultado por unidade
    const grupoUnidades = ['Matriz', 'Franquias', 'Itaim', 'Menino Deus', 'GG House', 'Capão'];
    const result = Object.entries(units).map(([name, d]) => ({
      name,
      receita: d.receita,
      despesa: d.despesa,
      resultado: d.receita - d.despesa,
      margem: d.receita > 0 ? ((d.receita - d.despesa) / d.receita * 100) : 0,
      dna: d.dna,
      isGrupo: grupoUnidades.includes(name),
    })).sort((a, b) => b.receita - a.receita);

    const totalGrupo = result.filter(r => r.isGrupo).reduce((s, r) => ({ receita: s.receita + r.receita, despesa: s.despesa + r.despesa }), { receita: 0, despesa: 0 });

    return { units: result, totalGrupo };
  }, [statusFilter, year, months]);

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Unidades — Ranking</h1>
          <div className="status-line">Comparativo entre unidades · {year}</div>
        </div>
      </div>

      {/* KPIs do grupo */}
      <div className="row row-4">
        <KpiTile label="Receita Grupo" value={fmtK(unitsData.totalGrupo.receita)} tone="green" />
        <KpiTile label="Despesa Grupo" value={fmtK(unitsData.totalGrupo.despesa)} tone="red" />
        <KpiTile label="Resultado Grupo" value={fmtK(unitsData.totalGrupo.receita - unitsData.totalGrupo.despesa)} tone={unitsData.totalGrupo.receita - unitsData.totalGrupo.despesa >= 0 ? 'green' : 'red'} />
        <KpiTile label="Unidades" value={String(unitsData.units.length)} tone="cyan" />
      </div>

      {/* Tabela de unidades */}
      <div className="card" style={{ padding: '24px' }}>
        <h2 className="card-title">Resultado por Unidade</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: '#fff' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #243038' }}>
              <th style={{ padding: '10px', textAlign: 'left' }}>Unidade</th>
              <th style={{ padding: '10px', textAlign: 'center', fontSize: 11 }}>Grupo</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Receita</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Despesa</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>DNA/G&A</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Resultado</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Margem</th>
            </tr>
          </thead>
          <tbody>
            {unitsData.units.map(u => (
              <tr key={u.name} style={{ borderBottom: '1px solid #1a242a', cursor: 'pointer' }} onClick={() => setDrilldown({ type: 'unidade', value: u.name, label: u.name })}>
                <td style={{ padding: '10px', fontWeight: 600 }}>{u.name}</td>
                <td style={{ padding: '10px', textAlign: 'center' }}>{u.isGrupo ? '✓' : '—'}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: '#10b981' }}>{fmtK(u.receita)}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: '#ef4444' }}>{fmtK(u.despesa)}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', color: '#f59e0b' }}>{fmtK(u.dna)}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, color: u.resultado >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtK(u.resultado)}</td>
                <td style={{ padding: '10px', textAlign: 'right', color: u.margem >= 0 ? 'var(--green)' : 'var(--red)' }}>{u.margem.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Receita por unidade - barras */}
      <div className="row">
        <div className="card" style={{ flex: 1 }}>
          <h2 className="card-title">Receita por Unidade</h2>
          <BarList items={unitsData.units.map(u => ({ name: u.name, value: u.receita }))} color="green" onItemClick={(it) => setDrilldown({ type: 'unidade', value: it.name, label: it.name })} activeName={drilldown && drilldown.type === 'unidade' ? drilldown.value : null} />
        </div>
        <div className="card" style={{ flex: 1 }}>
          <h2 className="card-title">Resultado por Unidade</h2>
          <BarList items={unitsData.units.map(u => ({ name: u.name, value: u.resultado })).filter(u => u.value !== 0)} color="cyan" onItemClick={(it) => setDrilldown({ type: 'unidade', value: it.name, label: it.name })} activeName={drilldown && drilldown.type === 'unidade' ? drilldown.value : null} />
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { PageDRE, PageFaturamentoTrinks, PageLojas });
