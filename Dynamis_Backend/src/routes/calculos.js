const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// ================= CALCULADORA DE MATERIAIS =================
router.post('/materiais', authMiddleware, async (req, res) => {
  try {
    const { ambientes } = req.body;
    if (!ambientes || !Array.isArray(ambientes)) {
      return res.status(400).json({ error: 'Informe os ambientes.' });
    }

    let resultado = [];
    let totais = { tomadas_tug: 0, tomadas_tue: 0, pontos_luz: 0, metros_fio_15: 0, metros_fio_25: 0, eletrodutos: 0, caixas_2x4: 0, caixas_4x4: 0 };

    for (const amb of ambientes) {
      const { tipo, comprimento, largura, altura = 2.8 } = amb;
      const area = parseFloat(comprimento) * parseFloat(largura);
      const perimetro = 2 * (parseFloat(comprimento) + parseFloat(largura));

      let tug = 0, tue = 0, pontos = 0, fio15 = 0, fio25 = 0, eletroduto = 0, cx2x4 = 0, cx4x4 = 0;

      switch (tipo) {
        case 'quarto':
          tug = Math.max(3, Math.ceil(perimetro / 5));
          tue = 1;
          pontos = 1;
          break;
        case 'sala':
          tug = Math.max(3, Math.ceil(perimetro / 5));
          tue = 1;
          pontos = Math.ceil(area / 12) + 1;
          break;
        case 'cozinha':
          tug = Math.ceil(perimetro / 3.5);
          tue = 3;
          pontos = 1;
          break;
        case 'banheiro':
          tug = 1;
          tue = 2;
          pontos = 1;
          break;
        case 'lavanderia':
          tug = 1;
          tue = 3;
          pontos = 1;
          break;
        case 'garagem':
          tug = 1;
          tue = 0;
          pontos = 1;
          break;
        case 'escritorio':
          tug = Math.max(4, Math.ceil(perimetro / 4));
          tue = 2;
          pontos = 1;
          break;
        default:
          tug = Math.ceil(perimetro / 5);
          tue = 0;
          pontos = 1;
      }

      const qtdTomadas = tug + tue;
      fio15 = Math.ceil((qtdTomadas * (parseFloat(altura) + 3)) * 1.3);
      fio25 = Math.ceil((pontos * (parseFloat(altura) + 2)) * 1.3);
      eletroduto = Math.ceil(((fio15 + fio25) / 3) * 1.2);
      cx2x4 = tug + tue;
      cx4x4 = pontos;

      totais.tomadas_tug += tug;
      totais.tomadas_tue += tue;
      totais.pontos_luz += pontos;
      totais.metros_fio_15 += fio15;
      totais.metros_fio_25 += fio25;
      totais.eletrodutos += eletroduto;
      totais.caixas_2x4 += cx2x4;
      totais.caixas_4x4 += cx4x4;

      resultado.push({
        ambiente: tipo,
        dimensoes: `${comprimento}m x ${largura}m`,
        area: area.toFixed(2),
        tomadas_tug: tug,
        tomadas_tue: tue,
        pontos_luz: pontos,
        metros_fio_15: fio15,
        metros_fio_25: fio25,
        eletrodutos: eletroduto,
        caixas_2x4: cx2x4,
        caixas_4x4: cx4x4
      });
    }

    return res.json({ ambientes: resultado, totais });
  } catch (err) {
    return res.status(500).json({ error: 'Erro no cálculo de materiais.' });
  }
});

// ================= DIMENSIONAMENTO DE TOMADAS =================
router.post('/tomadas', authMiddleware, async (req, res) => {
  try {
    const { tipo, comprimento, largura } = req.body;
    if (!tipo || !comprimento || !largura) {
      return res.status(400).json({ error: 'Informe tipo, comprimento e largura.' });
    }

    const perimetro = 2 * (parseFloat(comprimento) + parseFloat(largura));
    const area = parseFloat(comprimento) * parseFloat(largura);

    const regras = {
      quarto: {
        tug_min: 3,
        tug_formula: `Mín. 3 TUGs (NBR 5410 - item 9.1.1.1.1)`,
        potencia_tug: 100,
        posicao: '1,20m do piso',
        tue: [{ descricao: 'Ponto para ar-condicionado', potencia: 1500, posicao: '1,80m do piso' }]
      },
      sala: {
        tug_min: 3,
        tug_formula: `Mín. 3 TUGs (NBR 5410)`,
        potencia_tug: 100,
        posicao: '0,30m do piso',
        tue: [{ descricao: 'Ponto para TV', potencia: 300, posicao: '0,30m do piso' }, { descricao: 'Ar-condicionado', potencia: 1500, posicao: '1,80m do piso' }]
      },
      cozinha: {
        tug_min: Math.ceil(perimetro / 3.5),
        tug_formula: `1 TUG a cada 3,5m de parede (NBR 5410 - item 9.1.1.1.1)`,
        potencia_tug: 600,
        posicao: '1,10m do piso (sobre bancada)',
        tue: [
          { descricao: 'Geladeira', potencia: 300, posicao: '0,30m do piso' },
          { descricao: 'Fogão (elétrico)', potencia: 6000, posicao: '0,30m do piso' },
          { descricao: 'Micro-ondas', potencia: 1200, posicao: '1,10m do piso' }
        ]
      },
      banheiro: {
        tug_min: 1,
        tug_formula: `Mín. 1 TUG (NBR 5410)`,
        potencia_tug: 100,
        posicao: '1,20m do piso',
        tue: [
          { descricao: 'Chuveiro elétrico', potencia: 7500, posicao: '2,30m do piso' }
        ]
      },
      lavanderia: {
        tug_min: 1,
        tug_formula: `Mín. 1 TUG (NBR 5410)`,
        potencia_tug: 100,
        posicao: '1,20m do piso',
        tue: [
          { descricao: 'Máquina de lavar', potencia: 2500, posicao: '0,30m do piso' },
          { descricao: 'Tanquinho/Secar', potencia: 1500, posicao: '0,30m do piso' },
          { descricao: 'Ferro de passar', potencia: 2000, posicao: '1,20m do piso' }
        ]
      }
    };

    const regra = regras[tipo] || { tug_min: Math.ceil(perimetro / 5), tue: [], tug_formula: 'NBR 5410', potencia_tug: 100, posicao: '1,20m do piso' };
    const tug = Math.max(regra.tug_min, Math.ceil(perimetro / 5));

    return res.json({
      ambiente: tipo,
      area: area.toFixed(2),
      perimetro: perimetro.toFixed(2),
      tug_quantidade: tug,
      tug_potencia: regra.potencia_tug,
      tug_posicao: regra.posicao,
      tug_formula: regra.tug_formula,
      tue: regra.tue,
      norma: 'NBR 5410:2004'
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro no dimensionamento de tomadas.' });
  }
});

// ================= PADRÃO DE ENTRADA =================
router.post('/padrao-entrada', authMiddleware, async (req, res) => {
  try {
    const { ambientes_config } = req.body;
    if (!ambientes_config) {
      return res.status(400).json({ error: 'Informe os dados da residência.' });
    }

    const {
      area_total,
      qtd_quartos,
      tem_chuveiro,
      tem_arcondicionado,
      tem_torneira_eletrica,
      tem_forno,
      tem_secadora,
      potencia_personalizada = 0
    } = ambientes_config;

    let potencia_total = 0;

    // Iluminação (10W/m²)
    potencia_total += parseFloat(area_total) * 10;

    // Tomadas gerais
    potencia_total += 1000 * parseInt(qtd_quartos || 1);

    // Equipamentos específicos
    if (tem_chuveiro) potencia_total += 7500;
    if (tem_arcondicionado) potencia_total += 3000;
    if (tem_torneira_eletrica) potencia_total += 4000;
    if (tem_forno) potencia_total += 6000;
    if (tem_secadora) potencia_total += 2500;

    potencia_total += parseFloat(potencia_personalizada);

    // Margem de segurança 30%
    const potencia_projeto = potencia_total * 1.3;

    // Corrente
    const corrente_monofasico = potencia_projeto / 127;
    const corrente_bifasico = potencia_projeto / 220;
    const corrente_trifasico = potencia_projeto / (Math.sqrt(3) * 220);

    let padrao, tensao, disjuntor, medidor, descricao;

    if (potencia_projeto <= 6000) {
      padrao = 'Monofásico';
      tensao = '127V ou 220V';
      disjuntor = corrente_monofasico <= 20 ? '20A' : corrente_monofasico <= 25 ? '25A' : corrente_monofasico <= 32 ? '32A' : '40A';
      medidor = '5(60)A';
      descricao = 'Residência de pequeno porte';
    } else if (potencia_projeto <= 10000) {
      padrao = 'Bifásico';
      tensao = '220V';
      disjuntor = corrente_bifasico <= 30 ? '30A' : corrente_bifasico <= 40 ? '40A' : '50A';
      medidor = '5(60)A';
      descricao = 'Residência de médio porte';
    } else {
      padrao = 'Trifásico';
      tensao = '127/220V';
      disjuntor = corrente_trifasico <= 32 ? '32A' : corrente_trifasico <= 50 ? '50A' : corrente_trifasico <= 63 ? '63A' : '80A';
      medidor = '10(100)A';
      descricao = 'Residência de grande porte';
    }

    return res.json({
      potencia_instalada: Math.round(potencia_total),
      potencia_projeto: Math.round(potencia_projeto),
      padrao,
      tensao,
      disjuntor_geral: disjuntor,
      medidor,
      descricao,
      norma: 'NBR 5410 + ABNT NBR 14136'
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro no cálculo do padrão de entrada.' });
  }
});

// ================= DIMENSIONAMENTO DE CONDUTORES =================
router.post('/condutores', authMiddleware, async (req, res) => {
  try {
    const { corrente, tipo_circuito, comprimento, tensao = 127 } = req.body;
    if (!corrente || !tipo_circuito || !comprimento) {
      return res.status(400).json({ error: 'Informe corrente, tipo de circuito e comprimento.' });
    }

    const I = parseFloat(corrente);
    const L = parseFloat(comprimento);
    const V = parseFloat(tensao);

    // Tabela simplificada de capacidade de condução (ABNT NBR 5410 - Tabela 36)
    const tabela = [
      { secao: 1.5, capacidade: 15.5 },
      { secao: 2.5, capacidade: 21 },
      { secao: 4, capacidade: 28 },
      { secao: 6, capacidade: 36 },
      { secao: 10, capacidade: 50 },
      { secao: 16, capacidade: 68 },
      { secao: 25, capacidade: 89 },
      { secao: 35, capacidade: 110 }
    ];

    // Fator de queda de tensão máxima (3% para circuito terminal, 5% total)
    const queda_max = tipo_circuito === 'terminal' ? 0.03 : 0.05;
    const queda_tensao_max = V * queda_max;
    const resistividade = 0.0172; // cobre mm²Ω/m

    // Seção mínima por queda de tensão
    const secao_qt = (2 * I * L * resistividade) / queda_tensao_max;

    // Seção mínima por capacidade de condução
    let secao_cc = tabela.find(t => t.capacidade >= I);
    if (!secao_cc) secao_cc = tabela[tabela.length - 1];

    const secao_final = Math.max(secao_qt, secao_cc.secao);
    const secao_normalizada = tabela.find(t => t.secao >= secao_final) || tabela[tabela.length - 1];

    const queda_real = (2 * I * L * resistividade) / secao_normalizada.secao;
    const queda_percentual = (queda_real / V) * 100;

    return res.json({
      corrente_projeto: I.toFixed(2),
      comprimento: L,
      tensao: V,
      secao_recomendada: `${secao_normalizada.secao}mm²`,
      capacidade_conducao: `${secao_normalizada.capacidade}A`,
      queda_tensao: queda_real.toFixed(2) + 'V',
      queda_percentual: queda_percentual.toFixed(2) + '%',
      aprovado: queda_percentual <= (queda_max * 100),
      norma: 'ABNT NBR 5410 - Tabela 36',
      recomendacao: `Utilize fio ${secao_normalizada.secao}mm² de cobre flexível`
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro no dimensionamento de condutores.' });
  }
});

// ================= DICIONÁRIO TÉCNICO =================
router.get('/dicionario', authMiddleware, async (req, res) => {
  const { termo } = req.query;

  const dicionario = [
    { termo: 'Amperagem (A)', definicao: 'Unidade de medida da intensidade de corrente elétrica. 1A = fluxo de 1 coulomb por segundo.' },
    { termo: 'Bitola do fio', definicao: 'Secção transversal do condutor elétrico, medida em mm². Determina a capacidade de condução de corrente.' },
    { termo: 'Chave DR', definicao: 'Dispositivo Residual (diferencial-residual). Protege pessoas contra choques elétricos detectando correntes de fuga.' },
    { termo: 'Chave DPS', definicao: 'Dispositivo de Proteção contra Surtos. Protege equipamentos contra variações de tensão (raios, descargas).' },
    { termo: 'Circuito terminal', definicao: 'Circuito que alimenta diretamente os pontos de utilização (tomadas, luminárias). Não alimenta outros circuitos.' },
    { termo: 'Conduíte / Eletroduto', definicao: 'Tubo rígido ou flexível utilizado para proteger e organizar os fios e cabos elétricos.' },
    { termo: 'Corrente de curto-circuito', definicao: 'Alta corrente que flui quando dois condutores se tocam diretamente. Causa superaquecimento e incêndio.' },
    { termo: 'Disjuntor', definicao: 'Dispositivo de proteção que interrompe o circuito automaticamente em caso de sobrecarga ou curto-circuito.' },
    { termo: 'Eletroduto', definicao: 'Ver Conduíte. Tubo para proteção mecânica de condutores elétricos.' },
    { termo: 'Fator de demanda', definicao: 'Relação entre a demanda máxima e a potência total instalada. Indica o uso simultâneo dos equipamentos.' },
    { termo: 'Fio terra', definicao: 'Condutor de proteção que conecta partes metálicas dos equipamentos ao solo, prevenindo choques.' },
    { termo: 'Fase', definicao: 'Condutor ativo que transporta a corrente elétrica. Identificado pelas cores preta, vermelha ou marrom (NBR 5410).' },
    { termo: 'GFCI / IDR', definicao: 'Interruptor Diferencial Residual. Detecta desequilíbrio de corrente e desliga o circuito em milissegundos.' },
    { termo: 'Neutro', definicao: 'Condutor de retorno da corrente. Identificado pela cor azul claro na NBR 5410.' },
    { termo: 'NBR 5410', definicao: 'Norma Brasileira que regulamenta instalações elétricas de baixa tensão em edificações. Principal norma do eletricista.' },
    { termo: 'PCMSO', definicao: 'Programa de Controle Médico de Saúde Ocupacional. Obrigatório para empresas com eletricistas (NR-7).' },
    { termo: 'Potência (W)', definicao: 'Unidade de medida do consumo ou geração de energia elétrica. P = V × I.' },
    { termo: 'Quadro de distribuição', definicao: 'Painel elétrico onde ficam os disjuntores dos circuitos da residência. Centro de distribuição da instalação.' },
    { termo: 'Queda de tensão', definicao: 'Perda de tensão ao longo do condutor. A NBR 5410 limita a 7% no total (4% alimentação + 3% terminal).' },
    { termo: 'TUG', definicao: 'Tomada de Uso Geral. Tomada para equipamentos portáteis comuns. Mínimo de 100W por ponto (NBR 5410).' },
    { termo: 'TUE', definicao: 'Tomada de Uso Específico. Tomada dedicada a um único equipamento fixo (chuveiro, geladeira, A/C).' },
    { termo: 'Tensão (V)', definicao: 'Diferença de potencial elétrico entre dois pontos. No Brasil: 127V ou 220V monofásico.' },
    { termo: 'Aterramento', definicao: 'Sistema de conexão elétrica ao solo. Essencial para proteção contra choques e surtos (NBR 5410).' },
    { termo: 'SPDA', definicao: 'Sistema de Proteção contra Descargas Atmosféricas (para-raios). Regulado pela NBR 5419.' },
    { termo: 'Caixa 2x4', definicao: 'Caixa elétrica de alvenaria para tomadas e interruptores simples. Dimensões: 2 x 4 polegadas.' },
    { termo: 'Caixa 4x4', definicao: 'Caixa elétrica maior, usada para luminárias e tomadas duplas. Dimensões: 4 x 4 polegadas.' }
  ];

  if (termo) {
    const filtrado = dicionario.filter(d =>
      d.termo.toLowerCase().includes(termo.toLowerCase()) ||
      d.definicao.toLowerCase().includes(termo.toLowerCase())
    );
    return res.json({ resultados: filtrado, total: filtrado.length });
  }

  return res.json({ resultados: dicionario, total: dicionario.length });
});

// ================= TIPOS DE LUMINÁRIAS =================
router.get('/luminarias', authMiddleware, async (req, res) => {
  const luminarias = [
    {
      tipo: 'LED Bulbo',
      potencia: '4W a 15W',
      uso: 'Uso geral em quartos, corredores e escritórios',
      vida_util: '15.000 a 25.000 horas',
      eficiencia: 'Alta (100-130 lm/W)',
      custo: 'Baixo',
      dica: 'Substituta direta da lâmpada incandescente. Ideal para a maioria dos ambientes.'
    },
    {
      tipo: 'LED Tubular (T8)',
      potencia: '10W a 20W',
      uso: 'Garagens, comércio, lavanderias, áreas de serviço',
      vida_util: '30.000 horas',
      eficiencia: 'Muito alta (120-150 lm/W)',
      custo: 'Médio',
      dica: 'Excelente para iluminação uniforme em grandes áreas.'
    },
    {
      tipo: 'Spot LED',
      potencia: '3W a 7W',
      uso: 'Iluminação de destaque, salas, cozinhas modernas',
      vida_util: '20.000 horas',
      eficiencia: 'Alta',
      custo: 'Médio',
      dica: 'Embutido em forro, cria efeito de luz direcionada e elegante.'
    },
    {
      tipo: 'Plafon LED',
      potencia: '12W a 36W',
      uso: 'Quartos, salas, corredores, banheiros',
      vida_util: '25.000 horas',
      eficiencia: 'Alta',
      custo: 'Médio',
      dica: 'Fixado no teto, distribui luz uniformemente pelo ambiente.'
    },
    {
      tipo: 'Luminária de Embutir',
      potencia: '18W a 40W',
      uso: 'Escritórios, salas comerciais, cozinhas',
      vida_util: '30.000 horas',
      eficiencia: 'Muito alta',
      custo: 'Alto',
      dica: 'Instalada no forro rebaixado. Muito usada em ambientes modernos.'
    },
    {
      tipo: 'Arandela',
      potencia: '5W a 15W',
      uso: 'Varandas, corredores, quartos, banheiros',
      vida_util: '20.000 horas',
      eficiencia: 'Média-alta',
      custo: 'Médio',
      dica: 'Instalada na parede. Complementa a iluminação principal com charme.'
    },
    {
      tipo: 'Luminária Pendente',
      potencia: '10W a 30W',
      uso: 'Mesas de jantar, ilhas de cozinha, espaços decorativos',
      vida_util: '20.000 horas',
      eficiencia: 'Média',
      custo: 'Variável',
      dica: 'Cria pontos focais. A altura ideal é 70-80cm acima da mesa de jantar.'
    },
    {
      tipo: 'Luminária Fluorescente',
      potencia: '20W a 65W',
      uso: 'Garagens, depósitos, áreas de serviço (uso legado)',
      vida_util: '8.000 a 12.000 horas',
      eficiencia: 'Média (60-90 lm/W)',
      custo: 'Baixo',
      dica: 'Em fase de substituição pelo LED. Menor eficiência e contém mercúrio.'
    },
    {
      tipo: 'LED Strip (Fita)',
      potencia: '4W a 20W/metro',
      uso: 'Rodapés, bancadas, sancas, iluminação indireta',
      vida_util: '25.000 horas',
      eficiencia: 'Alta',
      custo: 'Médio',
      dica: 'Cria efeitos de luz indireta. Disponível em RGB para ambientes modernos.'
    },
    {
      tipo: 'Tartaruga / Luminária Externa',
      potencia: '7W a 15W',
      uso: 'Áreas externas, jardins, garagens cobertas',
      vida_util: '20.000 horas',
      eficiencia: 'Alta',
      custo: 'Médio',
      dica: 'Deve ter grau de proteção IP65 ou superior para uso externo.'
    }
  ];

  return res.json({ luminarias, total: luminarias.length });
});

module.exports = router;
