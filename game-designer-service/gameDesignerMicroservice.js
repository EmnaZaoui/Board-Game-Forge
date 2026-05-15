require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const sqlite3 = require('sqlite3');
const { Kafka } = require('kafkajs');

const kafka = new Kafka({ brokers: [process.env.KAFKA_BROKER] });
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'game-designer-group' });

const protoPath = 'gameDesigner.proto';
const packageDefinition = protoLoader.loadSync(protoPath);
const proto = grpc.loadPackageDefinition(packageDefinition).gamedesigner;

const db = new sqlite3.Database(process.env.DATABASE_PATH);
db.run(`CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  rules TEXT,
  creatorId TEXT,
  averageRating REAL,
  categories TEXT,
  createdAt TEXT
)`);

function generateUUID() { return Date.now() + '-' + Math.random().toString(36); }

const server = new grpc.Server();
server.addService(proto.GameDesignerService.service, {
  CreateGame: async (call, callback) => {
    const { name, description, rules, creatorId, categories } = call.request;
    const id = generateUUID();
    const createdAt = new Date().toISOString();
    const categoriesStr = JSON.stringify(categories);
    db.run(`INSERT INTO games (id, name, description, rules, creatorId, averageRating, categories, createdAt) VALUES (?,?,?,?,?,?,?,?)`,
      [id, name, description, rules, creatorId, 0, categoriesStr, createdAt], async (err) => {
        if (err) return callback({ code: grpc.status.INTERNAL, details: err.message });
        const game = { id, name, description, rules, creatorId, averageRating: 0, categories, createdAt };
        if (categories && categories.length > 0) {
          await producer.connect();
          await producer.send({
            topic: 'game.published',
            messages: [{ value: JSON.stringify({ gameId: id, title: name, categories, creatorId }) }]
          });
        }
        callback(null, { game });
      });
  },
  GetGame: (call, callback) => {
    db.get(`SELECT * FROM games WHERE id = ?`, [call.request.gameId], (err, row) => {
      if (err || !row) return callback({ code: grpc.status.NOT_FOUND, details: 'Game not found' });
      row.categories = JSON.parse(row.categories);
      callback(null, { game: row });
    });
  },
  UpdateGame: (call, callback) => {
    const { gameId, name, description, rules, categories } = call.request;
    const categoriesStr = JSON.stringify(categories);
    db.run(`UPDATE games SET name=?, description=?, rules=?, categories=? WHERE id=?`, [name, description, rules, categoriesStr, gameId], (err) => {
      if (err) callback({ code: grpc.status.INTERNAL, details: err.message });
      else callback(null, { success: true });
    });
  },
  DeleteGame: (call, callback) => {
    db.run(`DELETE FROM games WHERE id=?`, [call.request.gameId], (err) => {
      if (err) callback({ code: grpc.status.INTERNAL, details: err.message });
      else callback(null, { success: true });
    });
  },
  ListGames: (call, callback) => {
    db.all(`SELECT * FROM games`, (err, rows) => {
      if (err) return callback({ code: grpc.status.INTERNAL, details: err.message });
      rows = rows.map(r => ({ ...r, categories: JSON.parse(r.categories) }));
      callback(null, { games: rows });
    });
  },
  UpdateRating: (call, callback) => {
    db.run(`UPDATE games SET averageRating=? WHERE id=?`, [call.request.newAverage, call.request.gameId], (err) => {
      if (err) callback({ code: grpc.status.INTERNAL, details: err.message });
      else callback(null, { success: true });
    });
  }
});

async function start() {
  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: 'game.rated', fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ message }) => {
      const { gameId, newAverageRating } = JSON.parse(message.value.toString());
      db.run(`UPDATE games SET averageRating=? WHERE id=?`, [newAverageRating, gameId]);
    }
  });
  server.bindAsync(`0.0.0.0:${process.env.PORT}`, grpc.ServerCredentials.createInsecure(), () => {
    server.start();
    console.log(`GameDesigner service on port ${process.env.PORT}`);
  });
}
start();