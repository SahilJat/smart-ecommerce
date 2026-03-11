const { Kafka } = require('kafkajs');
require('dotenv').config();

const kafka = new Kafka({
  clientId: 'ecommerce-backend',
  brokers: [process.env.KAFKA_BROKER],
  ssl: {
    rejectUnauthorized: false
  },
  sasl: {
    mechanism: 'scram-sha-256',
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD
  },

  retry: {
    initialRetryTime: 1000,
    retries: 10
  }
});

module.exports = kafka;
