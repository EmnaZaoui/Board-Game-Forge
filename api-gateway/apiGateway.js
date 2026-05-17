
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { Kafka } = require('kafkajs');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Clients gRPC ----------
function loadProto(protoFile) {
  const protoPath = path.join(__dirname, protoFile);
  const packageDefinition = protoLoader.loadSync(protoPath);
  return grpc.loadPackageDefinition(packageDefinition);
}

const authProto = loadProto('auth.proto').auth;
const gameProto = loadProto('gameDesigner.proto').gamedesigner;
const playtestProto = loadProto('playtest.proto').playtest;
const recProto = loadProto('recommendation.proto').recommendation;

const authClient = new authProto.AuthService(
  process.env.AUTH_SERVICE_URL,
  grpc.credentials.createInsecure()
);
const gameClient = new gameProto.GameDesignerService(
  process.env.GAME_DESIGNER_SERVICE_URL,
  grpc.credentials.createInsecure()
);
const playtestClient = new playtestProto.PlaytestService(
  process.env.PLAYTEST_SERVICE_URL,
  grpc.credentials.createInsecure()
);
const recClient = new recProto.RecommendationService(
  process.env.RECOMMENDATION_SERVICE_URL,
  grpc.credentials.createInsecure()
);

// ---------- Middleware JWT via gRPC ----------
async function verifyToken(token) {
  return new Promise((resolve) => {
    authClient.verifyToken({ token }, (err, resp) => {
      if (err || !resp.valid) resolve(null);
      else resolve({ userId: resp.userId, username: resp.username });
    });
  });
}

app.use(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const user = await verifyToken(token);
    if (user) req.user = user;
  }
  next();
});

// ---------- Routes REST ----------
app.post('/api/auth/register', (req, res) => {
  authClient.register(req.body, (err, resp) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(resp);
  });
});

app.post('/api/auth/login', (req, res) => {
  authClient.login(req.body, (err, resp) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(resp);
  });
});

function authRequired(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.get('/api/games', (req, res) => {
  gameClient.listGames({}, (err, resp) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(resp.games);
  });
});

app.get('/api/games/:id', (req, res) => {
  gameClient.getGame({ gameId: req.params.id }, (err, resp) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(resp.game);
  });
});

app.post('/api/games', authRequired, (req, res) => {
  const { name, description, rules, categories } = req.body;
  gameClient.createGame({ name, description, rules, creatorId: req.user.userId, categories }, (err, resp) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(resp.game);
  });
});

app.put('/api/games/:id', authRequired, (req, res) => {
  gameClient.updateGame({ gameId: req.params.id, ...req.body }, (err, resp) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(resp);
  });
});

app.delete('/api/games/:id', authRequired, (req, res) => {
  gameClient.deleteGame({ gameId: req.params.id }, (err, resp) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(resp);
  });
});

app.post('/api/playtest/start', authRequired, (req, res) => {
  playtestClient.startPlaytest({ gameId: req.body.gameId, userId: req.user.userId }, (err, resp) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(resp.session);
  });
});

app.post('/api/playtest/:id/move', authRequired, (req, res) => {
  playtestClient.submitMove({ sessionId: req.params.id, moveJson: req.body.moveJson }, (err, resp) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(resp);
  });
});

app.post('/api/playtest/:id/complete', authRequired, (req, res) => {
  playtestClient.completePlaytest({ sessionId: req.params.id, score: req.body.score }, (err, resp) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(resp);
  });
});

app.get('/api/recommendations/:userId', (req, res) => {
  recClient.getRecommendations({ userId: req.params.userId, limit: 10 }, (err, resp) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(resp.recommendations);
  });
});

// ---------- GraphQL ----------
const typeDefs = fs.readFileSync(path.join(__dirname, 'schema.gql'), 'utf8');
const resolvers = require('./resolvers')({ gameClient, playtestClient, recClient, authClient });

const server = new ApolloServer({ typeDefs, resolvers });
async function startGraphQL() {
  await server.start();
  app.use('/graphql', expressMiddleware(server, {
    context: async ({ req }) => {
      let user = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        user = await verifyToken(token);
      }
      return { user, gameClient, playtestClient, recClient, authClient };
    }
  }));
}
startGraphQL();


// ---------- SSE pour Kafka (affichage temps réel) ----------
const kafka = new Kafka({ brokers: [process.env.KAFKA_BROKER || 'localhost:9092'] });
const consumer = kafka.consumer({ groupId: 'api-gateway-sse-group' });

let clients = [];
let lastEvents = []; // garder les 50 derniers événements

async function startKafkaConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topics: ['game.published', 'playtest.completed', 'game.rated'], fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const event = {
        topic,
        value: JSON.parse(message.value.toString()),
        timestamp: new Date().toISOString()
      };
      lastEvents.unshift(event);
      if (lastEvents.length > 50) lastEvents.pop();
      clients.forEach(client => client.write(`data: ${JSON.stringify(event)}\n\n`));
    }
  });
}
startKafkaConsumer().catch(console.error);

// Route SSE
app.get('/api/kafka/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write('retry: 10000\n\n');
  lastEvents.forEach(event => res.write(`data: ${JSON.stringify(event)}\n\n`));
  const clientId = Date.now();
  const newClient = { id: clientId, write: res.write.bind(res) };
  clients.push(newClient);
  req.on('close', () => {
    clients = clients.filter(c => c.id !== clientId);
  });
});

app.get('/api/kafka/history', (req, res) => {
  res.json(lastEvents);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API Gateway running on http://localhost:${PORT}`);
});