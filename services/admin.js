const kafka = require('../config/kafka');

const initKafkaTopic = async () => {
  const admin = kafka.admin();

  try {
    console.log('🛠️  Admin connecting to Kafka...');
    await admin.connect();

    // Ask Kafka to create our topic
    const topicCreated = await admin.createTopics({
      topics: [
        {
          topic: 'orders-topic',
          numPartitions: 1 // We only need 1 partition for local development
        }
      ],
    });

    if (topicCreated) {
      console.log('✅ Kafka Topic "orders-topic" created successfully!');
    } else {
      console.log('ℹ️  Kafka Topic "orders-topic" already exists.');
    }

  } catch (error) {
    console.error('❌ Admin Topic Creation Error:', error);
  } finally {
    // Always disconnect the admin when finished
    await admin.disconnect();
  }
};

module.exports = { initKafkaTopic };
