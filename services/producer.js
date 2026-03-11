const kafka = require('../config/kafka');

const producer = kafka.producer();

const connectProducer = async () => {
  await producer.connect();
  console.log('📤 Kafka Producer connected successfully');
};
const sendOrderEvent = async (orderData) => {
  await producer.send({
    topic: 'orders-topic', // This is the "channel" we are broadcasting on
    messages: [
      { value: JSON.stringify(orderData) }, // Kafka only accepts strings/buffers
    ],
  });
};

module.exports = { connectProducer, sendOrderEvent };
