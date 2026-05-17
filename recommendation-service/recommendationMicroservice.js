require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const sqlite3 = require('sqlite3');
const { Kafka } = require('kafkajs');

const kafka = new Kafka({ brokers: [process.env.KAFKA_BROKER] });
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'rec-service-group' });

const packageDefinition = protoLoader.loadSync('recommendation.proto');
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

async function consumeGamePublished(message) {
  const { gameId, title, categories } = JSON.parse(message.value.toString());
  console.log(`📥 game.published reçu : ${gameId} - ${title}`);
  db.run(
    `INSERT OR REPLACE INTO games (id, name, categories) VALUES (?,?,?)`,
    [gameId, title, JSON.stringify(categories)]
  );
}

async function consumePlaytestCompleted(message) {
  const { sessionId, gameId, userId, score } = JSON.parse(message.value.toString());
  console.log(`📥 playtest.completed reçu : session=${sessionId} game=${gameId} score=${score}`);
  db.run(
    `INSERT INTO playtest_scores (sessionId, gameId, userId, score) VALUES (?,?,?,?)`,
    [sessionId, gameId, userId, score],
    async () => {
      const newAvg = await computeAverageRating(gameId);
      await producer.send({
        topic: 'game.rated',
        messages: [{ value: JSON.stringify({ gameId, newAverageRating: newAvg }) }]
      });
    }
  );
}

const server = new grpc.Server();
server.addService(proto.RecommendationService.service, {
  GetRecommendations: (call, callback) => {
    const { userId, limit } = call.request;
    const maxResults = limit || 10;

    // Niveau 1 : filtrage collaboratif
    db.all(`
      SELECT g.id, g.name, COUNT(ps2.gameId) as score
      FROM playtest_scores ps1
      JOIN playtest_scores ps2
        ON ps1.userId != ps2.userId
        AND ps1.gameId = ps2.gameId
      JOIN games g ON g.id = ps2.gameId
      WHERE ps1.userId = ?
      GROUP BY ps2.gameId
      ORDER BY score DESC
      LIMIT ?
    `, [userId, maxResults], (err, rows) => {
      if (err) return callback({ code: grpc.status.INTERNAL, details: err.message });

      if (rows && rows.length >= 3) {
        console.log(`Reco collaborative : ${rows.length} jeux pour user ${userId}`);
        return callback(null, {
          recommendations: rows.map(r => ({ gameId: r.id, name: r.name, score: r.score }))
        });
      }

      // Niveau 2 : jeux les mieux notés non encore joués par cet user
      db.all(`
        SELECT g.id, g.name, COALESCE(AVG(ps.score), 0) as score
        FROM games g
        LEFT JOIN playtest_scores ps ON ps.gameId = g.id
        WHERE g.id NOT IN (
          SELECT gameId FROM playtest_scores WHERE userId = ?
        )
        GROUP BY g.id
        ORDER BY score DESC
        LIMIT ?
      `, [userId, maxResults], (err2, fallbackRows) => {
        if (err2) return callback({ code: grpc.status.INTERNAL, details: err2.message });

        if (fallbackRows && fallbackRows.length > 0) {
          console.log(`Reco par note : ${fallbackRows.length} jeux pour user ${userId}`);
          return callback(null, {
            recommendations: fallbackRows.map(r => ({
              gameId: r.id, name: r.name, score: parseFloat(r.score) || 0
            }))
          });
        }

        // Niveau 3 : tous les jeux disponibles
        db.all(`SELECT id, name, 0 as score FROM games LIMIT ?`, [maxResults], (err3, allGames) => {
          if (err3) return callback({ code: grpc.status.INTERNAL, details: err3.message });
          console.log(`Reco fallback total : ${(allGames || []).length} jeux`);
          callback(null, {
            recommendations: (allGames || []).map(r => ({ gameId: r.id, name: r.name, score: 0 }))
          });
        });
      });
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

start().catch(console.error);