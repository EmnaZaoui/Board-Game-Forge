require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const sqlite3 = require('sqlite3');
const { Kafka } = require('kafkajs');

const kafka = new Kafka({ brokers: [process.env.KAFKA_BROKER] });
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'rec-service-group' });

const protoPath = 'recommendation.proto';
const packageDefinition = protoLoader.loadSync(protoPath);
const proto = grpc.loadPackageDefinition(packageDefinition).recommendation;

const db = new sqlite3.Database(process.env.DATABASE_PATH);
db.run(`CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, name TEXT, categories TEXT)`);
db.run(`CREATE TABLE IF NOT EXISTS playtest_scores (sessionId TEXT, gameId TEXT, userId TEXT, score INT)`);

function computeAverageRating(gameId) {
  return new Promise((resolve) => {
    db.get(`SELECT AVG(score) as avg FROM playtest_scores WHERE gameId = ?`, [gameId], (err, row) => {
      resolve(row?.avg || 0);
    });
  });
}

async function produceGameRated(gameId, newAvg) {
  await producer.send({
    topic: 'game.rated',
    messages: [{ value: JSON.stringify({ gameId, newAverageRating: newAvg }) }]
  });
}

async function consumeGamePublished(message) {
  const { gameId, title, categories } = JSON.parse(message.value.toString());
  db.run(`INSERT OR REPLACE INTO games (id, name, categories) VALUES (?,?,?)`, [gameId, title, JSON.stringify(categories)]);
}

async function consumePlaytestCompleted(message) {
  const { sessionId, gameId, userId, score } = JSON.parse(message.value.toString());
  db.run(`INSERT INTO playtest_scores (sessionId, gameId, userId, score) VALUES (?,?,?,?)`, [sessionId, gameId, userId, score], async () => {
    const newAvg = await computeAverageRating(gameId);
    await produceGameRated(gameId, newAvg);
  });
}

const server = new grpc.Server();
server.addService(proto.RecommendationService.service, {
  GetRecommendations: (call, callback) => {
    const { userId, limit } = call.request;
    // Simple recommandation : jeux les plus joués par les utilisateurs qui ont joué aux mêmes jeux que userId
    db.all(`SELECT g.id, g.name, COUNT(ps2.gameId) as score
            FROM playtest_scores ps1
            JOIN playtest_scores ps2 ON ps1.userId != ps2.userId AND ps1.gameId = ps2.gameId
            JOIN games g ON g.id = ps2.gameId
            WHERE ps1.userId = ?
            GROUP BY ps2.gameId
            ORDER BY score DESC LIMIT ?`, [userId, limit || 10], (err, rows) => {
      if (err) return callback({ code: grpc.status.INTERNAL, details: err.message });
      const recommendations = rows.map(r => ({ gameId: r.id, name: r.name, score: r.score }));
      callback(null, { recommendations });
    });
  }
});

async function start() {
  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topics: ['game.published', 'playtest.completed'], fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (topic === 'game.published') await consumeGamePublished(message);
      else if (topic === 'playtest.completed') await consumePlaytestCompleted(message);
    }
  });
  server.bindAsync(`0.0.0.0:${process.env.PORT}`, grpc.ServerCredentials.createInsecure(), () => {
    server.start();
    console.log(`Recommendation service on port ${process.env.PORT}`);
  });
}
start();