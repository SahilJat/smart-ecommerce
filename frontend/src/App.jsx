import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'https://your-render-url.onrender.com/api';
const USER_ID = 1; // Hardcoded for our test user

function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  // 👉 NEW: State to hold the total calculated by the backend
  const [cartTotal, setCartTotal] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  // 1. Fetch Products and Cart on load
  useEffect(() => {
    fetchProducts();
    fetchCart();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API_URL}/products`);
      setProducts(response.data.data);
    } catch (error) {
      console.error('Error fetching products', error);
    }
  };

  const fetchCart = async () => {
    try {
      const response = await axios.get(`${API_URL}/cart/${USER_ID}`);
      setCart(response.data.cart || []);
      // 👉 NEW: Save the total from the backend
      setCartTotal(response.data.cartTotal || 0);
    } catch (error) {
      console.error('Error fetching cart', error);
    }
  };

  // 2. Add Item to Redis Cart
  const addToCart = async (product) => {
    try {
      setStatusMessage(`Adding ${product.name} to cart...`);
      await axios.post(`${API_URL}/cart/${USER_ID}`, {
        productId: product.id,
        quantity: 1,
        price: product.price,
      });
      await fetchCart(); // Refresh the cart UI instantly
      setStatusMessage('Item added to Redis Cache! ⚡');
    } catch (error) {
      setStatusMessage('Failed to add item.');
    }
  };

  // 3. Checkout (Triggers Kafka and clears Redis)
  const handleCheckout = async () => {
    try {
      setStatusMessage('Processing Checkout...');
      const response = await axios.post(`${API_URL}/checkout/${USER_ID}`);

      setStatusMessage(`✅ ${response.data.message} (Order ID: ${response.data.orderId})`);
      setCart([]); // Clear the UI cart
      setCartTotal(0); // 👉 NEW: Reset the total to zero
    } catch (error) {
      setStatusMessage(error.response?.data?.error || 'Checkout failed.');
    }
  };

  // --- UI RENDER ---
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>🚀 Smart E-Commerce Dashboard</h1>

      {/* Status Alert Bar */}
      {statusMessage && (
        <div style={{ padding: '10px', backgroundColor: '#e0f7fa', color: '#006064', marginBottom: '20px', borderRadius: '5px' }}>
          <strong>Status:</strong> {statusMessage}
        </div>
      )}

      <div style={{ display: 'flex', gap: '2rem' }}>

        {/* LEFT COLUMN: Products from PostgreSQL */}
        <div style={{ flex: 2 }}>
          <h2>Catalog (PostgreSQL)</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {products.map(product => (
              <div key={product.id} style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '8px' }}>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <p><strong>₹{product.price}</strong></p>
                <button
                  onClick={() => addToCart(product)}
                  style={{ background: '#007bff', color: 'white', padding: '10px', border: 'none', cursor: 'pointer', width: '100%', borderRadius: '4px' }}
                >
                  Add to Cart
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Cart from Redis */}
        <div style={{ flex: 1, backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '8px', height: 'fit-content' }}>
          <h2>Shopping Cart (Redis)</h2>
          {cart.length === 0 ? (
            <p>Your cart is empty.</p>
          ) : (
            <div>
              <ul style={{ paddingLeft: '20px', listStyleType: 'none', margin: 0, padding: 0 }}>
                {cart.map((item, index) => {

                  // 👉 THE FIX: Look up the product details from the PostgreSQL catalog
                  const catalogItem = products.find(p => p.id === item.productId);
                  const productName = catalogItem ? catalogItem.name : `Product ID ${item.productId}`;

                  return (
                    <li key={index} style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px', marginBottom: '10px' }}>
                      {/* Now we display the actual name! */}
                      <strong>{productName}</strong> <br />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                        <span>Qty: {item.quantity}</span>
                        <span style={{ color: '#27ae60', fontWeight: 'bold' }}>₹{item.itemTotal}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <hr style={{ margin: '20px 0', border: 'none', borderTop: '2px solid #ccc' }} />

              {/* 👉 NEW: Display the Grand Total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>Grand Total:</h3>
                <h3 style={{ margin: 0, color: '#e74c3c' }}>₹{cartTotal}</h3>
              </div>

              <button
                onClick={handleCheckout}
                style={{ background: '#28a745', color: 'white', padding: '15px', border: 'none', cursor: 'pointer', width: '100%', fontSize: '16px', fontWeight: 'bold', borderRadius: '4px' }}
              >
                Checkout Now
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default App;
