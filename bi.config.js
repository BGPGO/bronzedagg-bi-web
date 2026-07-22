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
      trinks_file: "faturamento_trinks_2026.xlsx",
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
      // Receitas (Trinks)
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
      "Juros recebidos": "receita",
      "Rendimento Aplicação": "receita",
      "Reembolso Studios": "receita",

      // Descontos Trinks (dedução)
      "Descontos Trinks": "deducao",

      // Impostos / deduções
      "Simples Nacional - DAS": "imposto",
      "ISS/Tributos": "imposto",
      "ICMS": "imposto",
      "INSS": "imposto",
      "INSS G&A": "imposto",
      "FGTS": "imposto",
      "FGTS G&A": "imposto",
      "IOF": "imposto",

      // Custos operacionais
      "CMV - Compra produtos fornecedor": "custo",
      "CSP - Insumos": "custo",
      "CSP - Produtos BGG": "custo",
      "CSP - Produtos LABOTERRA": "custo",
      "Comissões": "custo",
      "Custos de Maquininha": "custo",
      "Importação": "custo",
      "Frete entre estoques": "custo",

      // Despesas operacionais (unidade)
      "Aluguel": "despesa",
      "Condomínio": "despesa",
      "Luz": "despesa",
      "Internet": "despesa",
      "Telefone": "despesa",
      "Manutenção": "despesa",
      "Segurança": "despesa",
      "Seguro": "despesa",
      "Lavanderia": "despesa",
      "Uniforme": "despesa",
      "Kit de Cuidados Funcionárias": "despesa",
      "Material para banheiro": "despesa",
      "Serviço/Material de Limpeza": "despesa",
      "Decoração Operação": "despesa",
      "Material de Escritório e Consumo": "despesa",
      "Software e Sistema": "despesa",
      "Consumo Clientes": "despesa",
      "Deslocamento para atendimento": "despesa",
      "Pagamento Profissional": "despesa",
      "Passagem/Vale Transporte": "despesa",
      "Mão de obra terceirizada": "despesa",
      "Exames Periódicos": "despesa",
      "13º salário": "despesa",
      "Rescisão": "despesa",
      "Correios/Entrega": "despesa",
      "Taxas Bancárias": "despesa",
      "Juros e Multas": "despesa",
      "Certificado Digital": "despesa",
      "Taxa de Alvará": "despesa",
      "Design Gráfico": "despesa",
      "Material Gráfico": "despesa",
      "Relacionamento clientes/fornecedores": "despesa",
      "Devolução/Estorno Cliente": "despesa",
      "Despesas a identificar": "despesa",

      // DNA / G&A (rateio entre unidades)
      "Aluguel G&A": "dna",
      "Internet G&A": "dna",
      "Telefone - G&A": "dna",
      "Contador G&A": "dna",
      "Pagamento Profissional G&A": "dna",
      "13º salário G&A": "dna",
      "Férias G&A": "dna",
      "Rescisão G&A": "dna",
      "INSS G&A": "dna",
      "FGTS G&A": "dna",
      "Uniforme G&A": "dna",
      "Material de Escritório e Consumo G&A": "dna",
      "Serviço/Material de Limpeza  G&A": "dna",
      "Decoração Operação G&A": "dna",
      "Deslocamentos G&A": "dna",
      "Integrações/Presentes G&A": "dna",
      "Mão de obra terceirizada G&A": "dna",
      "Treinamentos G&A": "dna",
      "Vale Alimentação G&A": "dna",
      "Plano de Saúde G&A": "dna",
      "Sistema G&A": "dna",

      // Marketing
      "Agência Marketing": "despesa",
      "Software de Marketing": "despesa",
      "Mídia Paga": "despesa",
      "Influenciadoras": "despesa",
      "Eventos Marketing": "despesa",
      "Integrações/Presentes": "despesa",

      // CAPEX / investimentos
      "16. CAPEX": "investimento",
      "Aquisição de Bens": "investimento",
      "Projetos Estratégicos e Reformas": "investimento",
      "Aquisição de Bens e Insumos - Café GG House": "investimento",

      // Financeiro
      "Empréstimo - Amortização": "financeiro",
      "Dividendos": "financeiro",
      "Pró-Labore": "financeiro",
      "Consultoria": "despesa",
      "Contador": "despesa",
      "Assessoria Jurídica": "despesa",
      "Assessoria Site": "despesa",
      "Despesas Judiciais": "despesa",
      "Despesas Processuais": "despesa",
      "Despesas de Viagem": "despesa",
      "Cartão de crédito": "outros",

      // Transferências (não entram no DRE)
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
