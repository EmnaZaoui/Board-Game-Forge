const { Kafka } = require('kafkajs');

const kafka = new Kafka({ brokers: ['localhost:9092'] });
const admin = kafka.admin();

async function createTopics() {
  await admin.connect();
  const topics = ['game.published', 'playtest.completed', 'game.rated'];
  for (const topic of topics) {
    await admin.createTopics({
      topics: [{ topic, numPartitions: 1, replicationFactor: 1 }]
    });
    console.log(`Topic ${topic} créé`);
  }
  await admin.disconnect();
}
createTopics().catch(console.error);