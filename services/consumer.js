const kafka = require('../config/kafka.js');
const prisma = require('../config/prisma.js');

const consumer = kafka.consumer({ groupId: 'order-processing-group' });

const connectConsumer = async () => {
  await consumer.connect();
  console.log('📥 Kafka Consumer connected and listening for orders...');

  await consumer.subscribe({ topic: 'orders-topic', fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const orderData = JSON.parse(message.value.toString());
      console.log(`[Worker] Picked up Order ID: ${orderData.orderId}. Processing payment...`);
      setTimeout(async () => {
        try {
          // Update the order status in PostgreSQL from PENDING to SUCCESS
          await prisma.order.update({
            where: { id: orderData.orderId },
            data: { status: 'SUCCESS' },
          });
          console.log(`✅ [Worker] Order ID: ${orderData.orderId} successfully processed and saved to DB!`);
        } catch (error) {
          console.error(`❌ [Worker] Failed to update Order ID: ${orderData.orderId}`, error);
        }
      }, 5000);
    },

  });
};
module.exports = { connectConsumer };
