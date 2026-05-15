require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { Kafka } = require('kafkajs');

const dbPromise = require('./db');

//Kafka
const kafka = new Kafka({ brokers: [process.env.KAFKA_BROKER || 'localhost:9092'] });
const producer = kafka.producer();

//Proto
const packageDefinition = protoLoader.loadSync('playtest.proto');
const proto = grpc.loadPackageDefinition(packageDefinition).playtest;

//Helpers
function toJson(doc) {
  return doc ? doc.toJSON() : null;
}

//handlers gRPC

// demarre une session de playtest
async function StartPlaytest(call, callback) {
  const { gameId, userId } = call.request;
  try {
    const { playtests, persistPlaytests, createId } = await dbPromise;

    const session = {
      id:          createId(),
      gameId,
      userId,
      state:       'in_progress',
      moves:       '[]',
      startedAt:   new Date().toISOString(),
      completedAt: '',
      score:       0
    };

    const inserted = await playtests.insert(session);
    await persistPlaytests(playtests);

    callback(null, { session: toJson(inserted) });
  } catch (err) {
    console.error('[StartPlaytest]', err.message);
    callback({ code: grpc.status.INTERNAL, details: err.message });
  }
}

// Soumet un mouvement dans une session existante
async function SubmitMove(call, callback) {
  const { sessionId, moveJson } = call.request;
  try {
    const { playtests, persistPlaytests } = await dbPromise;

    const doc = await playtests.findOne(sessionId).exec();
    if (!doc) {
      return callback({ code: grpc.status.NOT_FOUND, details: 'Session non trouvée' });
    }

    // deserialiserles moves existants, ajouter le nouveau, re-sérialiser
    const moves = JSON.parse(doc.get('moves') || '[]');
    moves.push(JSON.parse(moveJson));

    // incrementalPatch disponible 
    const updatedDoc = await doc.incrementalPatch({ moves: JSON.stringify(moves) });
    await persistPlaytests(playtests);

    callback(null, { success: true, newState: updatedDoc.get('state') });
  } catch (err) {
    console.error('[SubmitMove]', err.message);
    callback({ code: grpc.status.INTERNAL, details: err.message });
  }
}

// recupere le statut d'une session
async function GetPlaytestStatus(call, callback) {
  const { sessionId } = call.request;
  try {
    const { playtests } = await dbPromise;

    const doc = await playtests.findOne(sessionId).exec();
    if (!doc) {
      return callback({ code: grpc.status.NOT_FOUND, details: 'Session non trouvée' });
    }

    callback(null, { session: toJson(doc) });
  } catch (err) {
    console.error('[GetPlaytestStatus]', err.message);
    callback({ code: grpc.status.INTERNAL, details: err.message });
  }
}

// termine une session et publie l'event Kafka
async function CompletePlaytest(call, callback) {
  const { sessionId, score } = call.request;
  try {
    const { playtests, persistPlaytests } = await dbPromise;

    const doc = await playtests.findOne(sessionId).exec();
    if (!doc) {
      return callback({ code: grpc.status.NOT_FOUND, details: 'Session non trouvée' });
    }

    // incrementalPatch pour mettre à jour plusieurs champs 
    const updatedDoc = await doc.incrementalPatch({
      state:       'completed',
      completedAt: new Date().toISOString(),
      score
    });
    await persistPlaytests(playtests);

    // publier l'event Kafka
    await producer.send({
      topic: 'playtest.completed',
      messages: [{
        value: JSON.stringify({
          sessionId: updatedDoc.get('id'),
          gameId:    updatedDoc.get('gameId'),
          userId:    updatedDoc.get('userId'),
          score,
          moves:     updatedDoc.get('moves')
        })
      }]
    });

    callback(null, { success: true });
  } catch (err) {
    console.error('[CompletePlaytest]', err.message);
    callback({ code: grpc.status.INTERNAL, details: err.message });
  }
}

// demarage du serveur
async function start() {
  // attendre que la DB soit prete
  await dbPromise;
  console.log('Base RxDB initialisée');

  try {
    await producer.connect();
    console.log('Kafka producer connecté');
  } catch (err) {
    console.warn('Kafka indisponible (les événements ne seront pas publiés) :', err.message);
  }

  const server = new grpc.Server();
  server.addService(proto.PlaytestService.service, {
    StartPlaytest,
    SubmitMove,
    GetPlaytestStatus,
    CompletePlaytest
  });

  const port = process.env.PORT || 50052;
  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        console.error('Erreur de démarrage gRPC :', err);
        process.exit(1);
      }
      console.log(`Playtest service (RxDB + gRPC) en écoute sur le port ${boundPort}`);
    }
  );
}

start().catch(err => {
  console.error('Erreur fatale :', err);
  process.exit(1);
});