const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const authMiddleware = require('../middleware/auth');

// Obter créditos do usuário
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('creditos, plano, nome, email')
      .eq('id', req.user.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Perfil não encontrado.' });

    return res.json({
      creditos: data.creditos,
      plano: data.plano,
      nome: data.nome,
      email: data.email,
      ilimitado: data.plano === 'unlimited'
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao buscar créditos.' });
  }
});

// Consumir 1 crédito
router.post('/usar', authMiddleware, async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('creditos, plano')
      .eq('id', req.user.id)
      .single();

    if (error || !profile) return res.status(404).json({ error: 'Perfil não encontrado.' });

    // Plano ilimitado não consome crédito
    if (profile.plano === 'unlimited') {
      return res.json({ success: true, creditos: -1, ilimitado: true });
    }

    if (profile.creditos <= 0) {
      return res.status(402).json({ error: 'Créditos insuficientes.', semCreditos: true });
    }

    const novosCreditos = profile.creditos - 1;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ creditos: novosCreditos })
      .eq('id', req.user.id);

    if (updateError) return res.status(500).json({ error: 'Erro ao consumir crédito.' });

    // Registrar uso
    await supabase.from('uso_creditos').insert({
      user_id: req.user.id,
      ferramenta: req.body.ferramenta || 'desconhecido',
      creditos_restantes: novosCreditos
    });

    return res.json({ success: true, creditos: novosCreditos, ilimitado: false });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao consumir crédito.' });
  }
});

module.exports = router;
