require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const creditsRoutes = require('./routes/credits');
const stripeRoutes = require('./routes/stripe');
const calculosRoutes = require('./routes/calculos');
const projectsRoutes = require('./routes/projects');

const app = express();
const PORT = process.env.PORT || 3001;

app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '2mb' }));

app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:5173', 'http://localhost:5173'],
  credentials: true,
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Muitas requisições, tente novamente em 15 minutos.' }
});
app.use('/api/', limiter);

app.use('/api/auth', authRoutes);
app.use('/api/credits', creditsRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/calculos', calculosRoutes);
app.use('/api/projects', projectsRoutes);

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Dynamis API funcionando!' });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
