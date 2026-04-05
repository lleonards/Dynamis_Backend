const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../services/supabase');
const authMiddleware = require('../middleware/auth');

const PLANS = {
  creditos_10: {
    priceId: process.env.PRICE_10_CREDITS,
    creditos: 10,
    plano: 'creditos_10',
    nome: '10 Créditos'
  },
  creditos_20: {
    priceId: process.env.PRICE_20_CREDITS,
    creditos: 20,
    plano: 'creditos_20',
    nome: '20 Créditos'
  },
  unlimited: {
    priceId: process.env.PRICE_UNLIMITED,
    creditos: 999999,
    plano: 'unlimited',
    nome: 'Créditos Ilimitados'
  }
};

// Criar sessão de checkout
router.post('/create-checkout', authMiddleware, async (req, res) => {
  try {
    const { planKey } = req.body;
    const plan = PLANS[planKey];
    if (!plan) return res.status(400).json({ error: 'Plano inválido.' });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancelado`,
      metadata: {
        user_id: req.user.id,
        plano: planKey,
        creditos: plan.creditos.toString()
      },
      client_reference_id: req.user.id
    });

    return res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Erro Stripe:', err);
    return res.status(500).json({ error: 'Erro ao criar sessão de pagamento.' });
  }
});

// Webhook Stripe
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook erro:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.user_id;
    const planKey = session.metadata?.plano;
    const creditos = parseInt(session.metadata?.creditos || '0');

    if (!userId || !planKey) {
      return res.status(200).json({ received: true });
    }

    try {
      if (planKey === 'unlimited') {
        await supabase
          .from('profiles')
          .update({ plano: 'unlimited', creditos: 999999 })
          .eq('id', userId);
      } else {
        // Incrementar créditos
        const { data: profile } = await supabase
          .from('profiles')
          .select('creditos')
          .eq('id', userId)
          .single();

        const novosCreditos = (profile?.creditos || 0) + creditos;
        await supabase
          .from('profiles')
          .update({ creditos: novosCreditos, plano: planKey })
          .eq('id', userId);
      }

      // Registrar pagamento
      await supabase.from('pagamentos').insert({
        user_id: userId,
        plano: planKey,
        creditos,
        stripe_session_id: session.id,
        valor: session.amount_total / 100
      });

    } catch (err) {
      console.error('Erro ao atualizar créditos:', err);
    }
  }

  return res.status(200).json({ received: true });
});

// Verificar sessão de pagamento (retorno)
router.get('/verify-session', authMiddleware, async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ error: 'Session ID não fornecido.' });

    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status === 'paid') {
      return res.json({ success: true, plano: session.metadata?.plano });
    }
    return res.json({ success: false });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao verificar sessão.' });
  }
});

module.exports = router;
