const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  DICIONARIO,
  LUMINARIAS,
  calcularTomadas,
  calcularMateriais,
  calcularPadraoEntrada,
  calcularCondutores,
  consumirCreditoSeNecessario,
  gerarRelatorioConsolidado
} = require('../services/calculoHelpers');

function handleError(res, err, defaultMessage) {
  return res.status(err.status || 500).json({
    error: err.message || defaultMessage,
    semCreditos: Boolean(err.semCreditos)
  });
}

router.post('/materiais', authMiddleware, async (req, res) => {
  try {
    const resultado = calcularMateriais(req.body || {});
    return res.json(resultado);
  } catch (err) {
    return handleError(res, err, 'Erro no cálculo de materiais.');
  }
});

router.post('/tomadas', authMiddleware, async (req, res) => {
  try {
    const resultado = calcularTomadas(req.body || {});
    return res.json(resultado);
  } catch (err) {
    return handleError(res, err, 'Erro no dimensionamento de tomadas.');
  }
});

router.post('/padrao-entrada', authMiddleware, async (req, res) => {
  try {
    const payload = req.body?.ambientes_config || req.body || {};
    const resultado = calcularPadraoEntrada(payload);
    return res.json(resultado);
  } catch (err) {
    return handleError(res, err, 'Erro no cálculo do padrão de entrada.');
  }
});

router.post('/condutores', authMiddleware, async (req, res) => {
  try {
    const resultado = calcularCondutores(req.body || {});
    return res.json(resultado);
  } catch (err) {
    return handleError(res, err, 'Erro no dimensionamento de condutores.');
  }
});

router.post('/gerar-relatorio', authMiddleware, async (req, res) => {
  try {
    const ferramentas = req.body?.ferramentas || {};
    const relatorio = gerarRelatorioConsolidado(ferramentas);
    const credito = await consumirCreditoSeNecessario(req.user.id, 'gerar-relatorio-consolidado');

    return res.json({
      ...relatorio,
      creditos: credito,
      mensagem: 'Relatório consolidado gerado com sucesso. O crédito foi consumido somente nesta etapa.'
    });
  } catch (err) {
    return handleError(res, err, 'Erro ao gerar relatório consolidado.');
  }
});

router.get('/dicionario', authMiddleware, async (req, res) => {
  const { termo } = req.query;

  if (termo) {
    const filtrado = DICIONARIO.filter(item =>
      item.termo.toLowerCase().includes(String(termo).toLowerCase()) ||
      item.definicao.toLowerCase().includes(String(termo).toLowerCase())
    );
    return res.json({ resultados: filtrado, total: filtrado.length });
  }

  return res.json({ resultados: DICIONARIO, total: DICIONARIO.length });
});

router.get('/luminarias', authMiddleware, async (req, res) => {
  return res.json({ luminarias: LUMINARIAS, total: LUMINARIAS.length });
});

module.exports = router;
