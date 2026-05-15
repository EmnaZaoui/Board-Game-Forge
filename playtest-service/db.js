const fs = require('fs/promises');
const path = require('path');
const { createHash, randomUUID } = require('crypto');
const { createRxDatabase } = require('rxdb');
const { getRxStorageMemory } = require('rxdb/plugins/storage-memory');
const { wrappedValidateAjvStorage } = require('rxdb/plugins/validate-ajv');

const DATA_DIR = path.join(__dirname, 'data');
const SNAPSHOT_FILE = path.join(DATA_DIR, 'playtests.snapshot.json');

// schema RxDB de la collection playtests
const playtestSchema = {
  title: 'playtest schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:          { type: 'string',  maxLength: 100 },
    gameId:      { type: 'string',  maxLength: 100 },
    userId:      { type: 'string',  maxLength: 100 },
    state:       { type: 'string',  enum: ['in_progress', 'completed'] },
    moves:       { type: 'string'  },   
    startedAt:   { type: 'string'  },
    completedAt: { type: 'string'  },
    score:       { type: 'integer' }
  },
  required: ['id', 'gameId', 'userId', 'state', 'moves', 'startedAt']
};


async function hashFunction(input) {
  if (input instanceof ArrayBuffer) {
    input = Buffer.from(input);
  }
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    input = Buffer.from(await input.arrayBuffer());
  }
  if (!Buffer.isBuffer(input)) {
    input = Buffer.from(String(input));
  }
  return createHash('sha256').update(input).digest('hex');
}

// charger le snapshot JSON depuis le disque
async function loadSnapshot() {
  try {
    const raw = await fs.readFile(SNAPSHOT_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

// persister toute la collection sur le disque
async function persistPlaytests(collection) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const docs = await collection.find().exec();
  const playtests = docs.map(doc => doc.toJSON());
  await fs.writeFile(SNAPSHOT_FILE, JSON.stringify(playtests, null, 2), 'utf8');
}

// initialiser la base RxDB 
async function initDatabase() {
  // storage memoire rt validation AJV
  const storage = wrappedValidateAjvStorage({
    storage: getRxStorageMemory()
  });

  const db = await createRxDatabase({
    name: 'playtestdb',
    storage,
    eventReduce: true,
    multiInstance: false,
    hashFunction
  });

  await db.addCollections({
    playtests: { schema: playtestSchema }
  });

  // restaurer les donnees depuis le snapshot
  const initialPlaytests = await loadSnapshot();
  if (initialPlaytests.length > 0) {
    await db.playtests.bulkInsert(initialPlaytests);
    console.log(`${initialPlaytests.length} sessions restaurées depuis le snapshot`);
  }

  return {
    db,
    playtests:         db.playtests,
    persistPlaytests,
    createId:          () => randomUUID()
  };
}

// exporter la promesse
module.exports = initDatabase();