const express = require('express');
const cors = require('cors');

require('dotenv').config();
const prisma = require('./config/prisma');
const { connectProducer, sendOrderEvent } = require('./services/producer.js');
const { connectConsumer } = require('./services/consumer.js');
const { initKafkaTopic } = require('./services/admin');
const { redisClient, connectRedis } = require('./config/redis');
const app = express();



app.use(cors());
app.use(express.json());

app.post('/api/users', async (req, res) => {
  try {
    const { name, email } = req.body;
    const newUser = await prisma.user.create({
      data: { name, email }
    });
    res.status(201).json({ status: 'success', data: newUser });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

//products routes
app.post('/api/products', async (req, res) => {
  try {
    const { name, description, price, stock } = req.body;
    const newProduct = await prisma.product.create({
      data: {
        name,
        description,
        price,
        stock,
      },
    });

    res.status(201).json({
      status: 'success',
      message: 'Product added to the catalog!',
      data: newProduct,
    });
  }
  catch (error) {
    console.error('❌ Error adding product:', error);
    res.status(500).json({ error: 'Failed to add product' });
  }

});

//fetch all  products
app.get('/api/products', async (req, res) => {
  try {
    // Prisma's built-in findMany method replaces raw SELECT queries
    const products = await prisma.product.findMany();

    res.status(200).json({
      status: 'success',
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});



// --- REDIS SHOPPING CART ROUTES ---

// 1. Add an item to the cart
// 1. Add an item to the cart
app.post('/api/cart/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { productId, quantity, price } = req.body;

    // Redis uses standard string keys. We will name our key "cart:1" for User ID 1.
    const cartKey = `cart:${userId}`;

    // 1. Fetch the existing cart from Redis
    let cart = await redisClient.get(cartKey);

    // Redis only stores strings, so we parse it back into a JavaScript array
    cart = cart ? JSON.parse(cart) : [];

    // 👉 THE FIX: 2. Check if the product already exists in the cart array
    const existingItemIndex = cart.findIndex(item => item.productId === productId);

    if (existingItemIndex > -1) {
      // 3a. It exists! Just add the new quantity to the existing quantity
      cart[existingItemIndex].quantity += quantity;
    } else {
      // 3b. It's a brand new product! Push it into the array
      cart.push({ productId, quantity, price });
    }

    // 4. Save it back to Redis with a 24-hour expiration (86400 seconds)
    await redisClient.setEx(cartKey, 86400, JSON.stringify(cart));

    res.status(200).json({
      status: 'success',
      message: 'Item zipped into Redis cache!',
      cart
    });
  } catch (error) {
    console.error('❌ Error adding to cart:', error);
    res.status(500).json({ error: 'Failed to update cart' });
  }
});
// 2. View the cart (Now with Calculated Totals!)
app.get('/api/cart/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const cartData = await redisClient.get(`cart:${userId}`);

    // If there is no cart, return an empty array and a $0 total
    if (!cartData) {
      return res.status(200).json({ status: 'success', cart: [], cartTotal: 0 });
    }

    const cart = JSON.parse(cartData);
    let cartTotal = 0;

    // Loop through the cart to calculate the totals
    const enrichedCart = cart.map(item => {
      // Calculate the total for this specific item (e.g., 3 speakers * $4500 = $13500)
      const itemTotal = item.price * item.quantity;

      // Add it to the grand total for the whole order
      cartTotal += itemTotal;

      return {
        ...item,
        itemTotal // We inject this new field so the frontend can display it easily!
      };
    });

    res.status(200).json({
      status: 'success',
      cart: enrichedCart,
      cartTotal
    });
  } catch (error) {
    console.error('❌ Error fetching cart:', error);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});
// 3. Clear the cart (Helper route for testing)
app.delete('/api/cart/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await redisClient.del(`cart:${userId}`);

    res.status(200).json({ status: 'success', message: 'Cart completely emptied!' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});
app.post('/api/checkout/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const cartKey = `cart:${userId}`;

    // Step A: Read the cart from Redis
    const cartData = await redisClient.get(cartKey);
    if (!cartData) {
      return res.status(400).json({ error: 'Your cart is empty!' });
    }

    const cart = JSON.parse(cartData);
    if (cart.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty!' });
    }

    // Step B: Calculate the total price and format items for Prisma
    let calculatedTotal = 0;
    const orderItems = cart.map(item => {
      calculatedTotal += (item.price * item.quantity);
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: item.price
      };
    });

    // Step C: Save the official Order to PostgreSQL
    const newOrder = await prisma.order.create({
      data: {
        userId: parseInt(userId),
        totalPrice: calculatedTotal,
        status: 'PENDING',
        items: {
          create: orderItems
        }
      }
    });

    // Step D: Send it to the Kafka Queue for background processing
    await sendOrderEvent({
      orderId: newOrder.id,
      userId: parseInt(userId),
      totalPrice: newOrder.totalPrice
    });

    // Step E: Clear the user's cart in Redis so they can shop again!
    await redisClient.del(cartKey);

    res.status(201).json({
      status: 'success',
      message: 'Checkout complete! Order sent to processing queue.',
      orderId: newOrder.id
    });

  } catch (error) {
    console.error('❌ Checkout Error:', error);
    res.status(500).json({ error: 'Checkout failed' });
  }
});
const PORT = process.env.PORT || 5000;
const startServer = async () => {
  // Connect to Kafka before opening the API to the public
  await initKafkaTopic();
  await connectProducer();
  await connectConsumer();
  await connectRedis();
  app.listen(PORT, () => {
    console.log(`🚀 E-commerce Server running on http://localhost:${PORT}`);
  });
};

startServer();
