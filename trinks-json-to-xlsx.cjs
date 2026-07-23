/**
 * trinks-json-to-xlsx.cjs — Converte JSONs existentes de BASES/TRINKS/ para XLSX
 *
 * Lê os JSONs no formato antigo (scrape manual) e gera o XLSX
 * no formato esperado pelo adapter bronzedagg.cjs.
 *
 * Uso: node trinks-json-to-xlsx.cjs [--ano 2026]
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');

const ANO = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--ano') || new Date().getFullYear(), 10);
const BASES_DIR = path.resolve('G:/Meu Drive/BGP/CLIENTES/BI/489. BRONZE DA GG/BASES');
const TRINKS_DIR = path.join(BASES_DIR, 'TRINKS');
const XLSX_OUT = path.join(BASES_DIR, `faturamento_trinks_${ANO}.xlsx`);

const UNIDADES = [
  { trinks: 'BGG Alphaville', slug: 'BGG_Alphaville' },
  { trinks: 'BGG Itaim', slug: 'BGG_Itaim' },
  { trinks: 'BGG Menino Deus', slug: 'BGG_Menino_Deus' },
  { trinks: 'GG House', slug: 'GG_House' },
];

function numBR(v) {
  if (v == null || v === '' || v === '-') return 0;
  const s = String(v).replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function pad2(n) { return String(n).padStart(2, '0'); }

/**
 * Parseia JSON antigo (scrape manual).
 *
 * Estrutura: resumo_tabelas[0] é um array grande onde:
 *   - Elementos pares a partir do índice 6 são arrays de dados diários
 *   - Formato de cada array de dia:
 *     ["", "dd/mm/yyyy (dia)", clientes, atend, ticket, serviços, produtos,
 *      pacotes, VP, CC, descontos, crédito, débito, dinheiro, prépago,
 *      outros, troco, gorjeta, total, ""]
 */
function parseOldJSON(json) {
  const dados = [];
  if (!json.resumo_tabelas?.[0]) return dados;

  const block = json.resumo_tabelas[0];

  for (let i = 0; i < block.length; i++) {
    const item = block[i];
    if (!Array.isArray(item)) continue;

    // Procurar arrays que contêm data dd/mm/yyyy no segundo elemento
    const dateCell = item[1];
    if (typeof dateCell !== 'string') continue;
    const dm = dateCell.match(/^(\d{2}\/\d{2}\/\d{4})/);
    if (!dm) continue;

    // item: ["", "dd/mm/yyyy (dia)", clientes, atend, ticket, serviços, produtos,
    //         pacotes, VP, CC, descontos, crédito, débito, dinheiro, prépago,
    //         outros, troco, gorjeta, total, ""]
    // Índices: 0=vazio, 1=data, 2=clientes, 3=atend, 4=ticket,
    //          5=serviços, 6=produtos, 7=pacotes, 8=VP, 9=CC, 10=descontos,
    //          11=crédito, 12=débito, 13=dinheiro, 14=prépago, 15=outros,
    //          16=troco, 17=gorjeta, 18=total, 19=vazio

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

function main() {
  console.log(`\n=== Convertendo JSONs Trinks → XLSX (${ANO}) ===\n`);

  const allRows = [];

  for (const unidade of UNIDADES) {
    let totalDias = 0;

    for (let m = 1; m <= 12; m++) {
      const label = `${ANO}-${pad2(m)}`;
      const jsonFile = path.join(TRINKS_DIR, `${unidade.slug}_${label}.json`);

      if (!fs.existsSync(jsonFile)) continue;

      try {
        const json = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
        let dados;

        if (json.dados_diarios) {
          dados = json.dados_diarios;
        } else {
          dados = parseOldJSON(json);
        }

        for (const d of dados) {
          const servicos = d.servicos || 0;
          const produtos = d.produtos || 0;
          const pacotes = d.pacotes || 0;
          const fatComercial = servicos + produtos + pacotes;

          allRows.push({
            'Unidade': unidade.trinks,
            'Data': d.data,
            'Serviços (R$)': servicos,
            'Produtos (R$)': produtos,
            'Pacotes (R$)': pacotes,
            'Vale-Presente (R$)': d.vale_presente || 0,
            'Crédito Cliente (R$)': d.credito_cliente || 0,
            'Descontos (R$)': d.descontos || 0,
            'Total Recebido (R$)': d.total_recebido || 0,
            'Faturamento Comercial (R$)': fatComercial,
          });
          totalDias++;
        }

        console.log(`  ${unidade.trinks} ${label}: ${dados.length} dias`);
      } catch (e) {
        console.warn(`  AVISO: erro lendo ${jsonFile}: ${e.message}`);
      }
    }

    console.log(`  → ${unidade.trinks}: ${totalDias} dias total\n`);
  }

  if (allRows.length === 0) {
    console.error('Nenhum dado encontrado nos JSONs!');
    process.exit(1);
  }

  // Ordenar por unidade e data
  allRows.sort((a, b) => {
    if (a['Unidade'] !== b['Unidade']) return a['Unidade'].localeCompare(b['Unidade']);
    const [da, ma, ya] = a['Data'].split('/');
    const [db, mb, yb] = b['Data'].split('/');
    return new Date(`${ya}-${ma}-${da}`) - new Date(`${yb}-${mb}-${db}`);
  });

  const ws = XLSX.utils.json_to_sheet(allRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Faturamento Diário');
  XLSX.writeFile(wb, XLSX_OUT);

  console.log(`=== XLSX gerado: ${XLSX_OUT} ===`);
  console.log(`Total: ${allRows.length} linhas de faturamento diário`);
}

main();
