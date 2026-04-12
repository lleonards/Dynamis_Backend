const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const authMiddleware = require('../middleware/auth');
const { consumirCreditoSeNecessario, gerarRelatorioConsolidado } = require('../services/calculoHelpers');

function totalizarEntradas(ferramentas = {}) {
  return ['materiais', 'tomadas', 'padraoEntrada', 'condutores']
    .reduce((acc, key) => acc + (Array.isArray(ferramentas[key]) ? ferramentas[key].length : (ferramentas[key] ? 1 : 0)), 0);
}

router.get('/history', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('projetos')
      .select('id, nome, total_registros, total_ferramentas, creditos_consumidos, created_at, updated_at, ultima_geracao_em')
      .eq('user_id', req.user.id)
      .order('ultima_geracao_em', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: 'Erro ao buscar histórico de projetos.' });
    return res.json({ projetos: data || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar histórico de projetos.' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('projetos')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Projeto não encontrado.' });
    return res.json({ projeto: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar projeto.' });
  }
});

router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const nomeProjeto = String(req.body?.nome_projeto || '').trim();
    const ferramentas = req.body?.ferramentas || {};

    if (!nomeProjeto) {
      return res.status(400).json({ error: 'Informe um nome para o projeto antes de gerar.' });
    }

    const totalRegistros = totalizarEntradas(ferramentas);
    if (!totalRegistros) {
      return res.status(400).json({ error: 'Salve pelo menos um item em alguma ferramenta antes de gerar.' });
    }

    const relatorio = gerarRelatorioConsolidado(ferramentas, nomeProjeto);
    const credito = await consumirCreditoSeNecessario(req.user.id, `geracao-projeto:${nomeProjeto}`);

    const payloadProjeto = {
      user_id: req.user.id,
      nome: nomeProjeto,
      dados_entrada: ferramentas,
      resultados: relatorio,
      total_registros: relatorio.total_registros,
      total_ferramentas: relatorio.total_ferramentas,
      creditos_consumidos: credito.consumido ? 1 : 0,
      ultima_geracao_em: relatorio.gerado_em
    };

    const { data, error } = await supabase
      .from('projetos')
      .insert(payloadProjeto)
      .select('*')
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao salvar o projeto gerado.' });
    }

    return res.json({
      success: true,
      mensagem: 'Projeto gerado com sucesso.',
      projeto: data,
      creditos: credito,
      relatorio
    });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({
      error: err.message || 'Erro ao gerar projeto.',
      semCreditos: Boolean(err.semCreditos)
    });
  }
});

module.exports = router;
