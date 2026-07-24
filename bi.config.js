// Configuração — Grupo Bronze da GG
// Multi-unidade com DRE consolidado + DNA rateado
module.exports = {
  cliente: {
    nome: "Grupo Bronze da GG",
    subdomain: "bronzedagg-bi",
    coolify_app_uuid: "lzsuuej0c72mz6h4vjjb0ruj",
    cor_primaria: "#b7906a",
  },

  fontes: {
    adapters: ["bronzedagg"],

    bronzedagg: {
      conta_azul_file: "extrato_financeiroBronzedagg.xlsx",
      trinks_file: "[Grupo BGG] Faturamento 2026.xlsx",
      trinks_sheet: "Relatório Sistema",
    },

    drive: {
      base_path: "G:/Meu Drive/BGP/CLIENTES/BI/489. BRONZE DA GG/BASES",
    },
  },

  // Estrutura do grupo
  grupo: {
    nome: "Grupo Bronze da GG",
    marca: "Bronze da GG",
    // Unidades que entram no DRE/DFC consolidado
    unidades_grupo: ["Matriz", "Franquias", "Itaim", "Menino Deus", "GG House", "Capão"],
    // Franquias próprias — só faturamento, fora do consolidado
    franquias_proprias: ["Alphaville", "Carlos Gomes"],
  },

  pages: {
    geral: {
      overview: "active",
      dre: "active",
      faturamento_trinks: "active",
      receita: "active",
      despesa: "active",
      fluxo: "active",
      tesouraria: "active",
      comparativo: "active",
      relatorio: "active",
      lojas: "active",
    },
    outros: {
      orcamento: "hidden",         // futuro: orçado × realizado
      indicators: "hidden",
      faturamento_produto: "hidden",
      curva_abc: "hidden",
      marketing: "hidden",
      hierarquia: "hidden",
      detalhado: "hidden",
      profunda_cliente: "hidden",
      crm: "hidden",
      risco: "hidden",
      valuation: "hidden",
    },
  },

  meta: {
    categoria_overrides: {
      // === FATURAMENTO (receitas) ===
      "1.1. Serviços de Bronze": "receita",
      "1.2. Produtos": "receita",
      "1.2.1. Produtos Franquias": "receita",
      "1.3. Sublocação": "receita",
      "1.5. Taxa Representação": "receita",
      "1.6. Royalties Franquia": "receita",
      "1.7. Taxa de Marketing": "receita",
      "1.9. Café": "receita",
      "1.10. Vendas TikTok": "receita",
      "1.11. Taxa de Franquia": "receita",
      "Receita não operacional": "receita",
      "Receitas a identificar": "receita",
      "Reembolso Studios": "receita",

      // === DEDUÇÕES ===
      "Descontos Trinks": "deducao",
      "Simples Nacional - DAS": "deducao",
      "Devolução/Estorno Cliente": "transferencia",
      "ISS/Tributos": "deducao",
      "ICMS": "deducao",

      // === CUSTOS > CMV ===
      "CMV - Compra produtos fornecedor": "custo",
      "CSP - Insumos": "custo",
      "CSP - Produtos BGG": "custo",
      "CSP - Produtos LABOTERRA": "custo",
      "Deslocamento para atendimento": "custo",
      "Aquisição de Bens e Insumos - Café GG House": "custo",
      "Importação": "custo",
      "Frete entre estoques": "custo",

      // === CUSTOS > CUSTO DE VENDA ===
      "Custos de Maquininha": "custo_venda",
      "Comissões": "custo_venda",
      "Correios/Entrega": "custo_venda",

      // === DESPESAS UNIDADES > PESSOAL ===
      "Pagamento Profissional": "desp_pessoal",
      "Mão de obra terceirizada": "desp_pessoal",
      "Rescisão": "desp_pessoal",
      "13º salário": "desp_pessoal",
      "INSS": "desp_pessoal",
      "FGTS": "desp_pessoal",
      "Integrações/Presentes": "desp_pessoal",
      "Kit de Cuidados Funcionárias": "desp_pessoal",
      "Uniforme": "desp_pessoal",

      // === DESPESAS UNIDADES > OPERAÇÃO ===
      "Aluguel": "desp_operacao",
      "Condomínio": "desp_operacao",
      "Luz": "desp_operacao",
      "Telefone": "desp_operacao",
      "Internet": "desp_operacao",
      "Software e Sistema": "desp_operacao",
      "Segurança": "desp_operacao",
      "Decoração Operação": "desp_operacao",
      "Serviço/Material de Limpeza": "desp_operacao",
      "Lavanderia": "desp_operacao",
      "Material de Escritório e Consumo": "desp_operacao",
      "Manutenção": "desp_operacao",
      "Seguro": "desp_operacao",
      "Contador": "desp_operacao",
      "Material para banheiro": "desp_operacao",
      "Consumo Clientes": "desp_operacao",

      // === DESPESAS UNIDADES > INVESTIMENTOS ===
      "16. CAPEX": "invest_unidade",
      "Aquisição de Bens": "invest_unidade",
      "Projetos Estratégicos e Reformas": "invest_unidade",

      // === DNA/G&A > PESSOAL G&A ===
      "Pró-Labore": "dna_pessoal",
      "Pagamento Profissional G&A": "dna_pessoal",
      "Mão de obra terceirizada G&A": "dna_pessoal",
      "Férias G&A": "dna_pessoal",
      "Rescisão G&A": "dna_pessoal",
      "13º salário G&A": "dna_pessoal",
      "INSS G&A": "dna_pessoal",
      "FGTS G&A": "dna_pessoal",
      "Passagem/Vale Transporte": "dna_pessoal",
      "Integrações/Presentes G&A": "dna_pessoal",
      "Uniforme G&A": "dna_pessoal",
      "Exames Periódicos": "dna_pessoal",
      "Vale Alimentação G&A": "dna_pessoal",
      "Plano de Saúde G&A": "dna_pessoal",

      // === DNA/G&A > ADMINISTRATIVAS ===
      "Aluguel G&A": "dna_admin",
      "Internet G&A": "dna_admin",
      "Telefone - G&A": "dna_admin",
      "Contador G&A": "dna_admin",
      "Material de Escritório e Consumo G&A": "dna_admin",
      "Serviço/Material de Limpeza  G&A": "dna_admin",
      "Decoração Operação G&A": "dna_admin",
      "Assessoria Jurídica": "dna_admin",
      "Consultoria": "dna_admin",
      "Taxas Bancárias": "dna_admin",
      "Deslocamentos G&A": "dna_admin",
      "Sistema G&A": "dna_admin",
      "Despesas Processuais": "dna_admin",
      "Despesas de Viagem": "dna_admin",
      "Taxa de Alvará": "dna_admin",
      "Despesas Judiciais": "dna_admin",
      "Certificado Digital": "dna_admin",

      // === DNA/G&A > MARKETING ===
      "Design Gráfico": "dna_marketing",
      "Agência Marketing": "dna_marketing",
      "Influenciadoras": "dna_marketing",
      "Mídia Paga": "dna_marketing",
      "Relacionamento clientes/fornecedores": "dna_marketing",
      "Material Gráfico": "dna_marketing",
      "Eventos Marketing": "dna_marketing",
      "Software de Marketing": "dna_marketing",
      "Assessoria Site": "dna_marketing",

      // === DNA/G&A > INVESTIMENTOS G&A ===
      "Treinamentos G&A": "dna_invest",

      // === NÃO IDENTIFICADOS ===
      "Despesas a identificar": "nao_identificado",
      "Cartão de crédito": "nao_identificado",

      // === RECEITA FINANCEIRA ===
      "Juros recebidos": "receita_fin",
      "Rendimento Aplicação": "transferencia",

      // === DESPESA FINANCEIRA ===
      "Juros e Multas": "despesa_fin",
      "IOF": "despesa_fin",

      // === DISTRIBUIÇÃO DE LUCROS ===
      "Dividendos": "distribuicao",

      // === FINANCEIRO (empréstimos etc) ===
      "Empréstimo - Amortização": "financeiro",

      // === TRANSFERÊNCIAS (não entram no DRE) ===
      "Transferência de Entrada": "transferencia",
      "Transferência de Saída": "transferencia",
      "Transferência entre Contas - Entradas": "transferencia",
      "Transferência entre Contas - Saídas": "transferencia",
      "Movimentações Entrada - SunGlow": "transferencia",
      "Movimentações Saída - SunGlow": "transferencia",
      "Saldo Inicial": "transferencia",
      "Estorno - Entrada": "transferencia",
      "Estorno - Saída": "transferencia",
    },
    ano_corrente: 2026,
  },

  template: {
    version_when_created: "1.0.0",
    version_last_synced: "1.0.0",
  },
};
