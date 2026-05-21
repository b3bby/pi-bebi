const express = require('express');
const apiRouter = require('./router');
const { sequelize } = require('./models');

const app = express();
const port = process.env.PORT || 3333;

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf ? buf.toString() : '';
    },
  })
);
app.use((req, res, next) => {
  const defaultAllowedHeaders = [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Idempotency-Key',
  ];
  const requestedHeaders = String(req.headers['access-control-request-headers'] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const allowHeaders = Array.from(new Set([...defaultAllowedHeaders, ...requestedHeaders]));

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', allowHeaders.join(', '));
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});

app.get('/', (req, res) => {
  res.json({ message: 'UMKM Bid API' });
});

app.use('/api', apiRouter);

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }

  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
};

startServer();
