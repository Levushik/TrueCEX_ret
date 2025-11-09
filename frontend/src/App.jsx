import React, { useState, useEffect } from 'react'


const API_BASE = 'http://127.0.0.1:8000'

export default function App() {
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState(localStorage.getItem('token') || null)
  
  const [orders, setOrders] = useState([])
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [], spread: 0 })
  const [ticker, setTicker] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  
  const [orderForm, setOrderForm] = useState({
    price: '',
    quantity: '',
    side: 'buy'
  })

  useEffect(() => {
    if (token) {
      const savedUsername = localStorage.getItem('username')
      if (savedUsername) setUsername(savedUsername)
      fetchMarketData()
      const interval = setInterval(fetchMarketData, 3000)
      return () => clearInterval(interval)
    }
  }, [token])  

  const fetchMarketData = async () => {
    try {
      const tickerRes = await fetch(`${API_BASE}/api/market/ticker/BTC-USDT`)
      const orderbookRes = await fetch(`${API_BASE}/api/market/orderbook/BTC-USDT`)
      
      if (tickerRes.ok) setTicker(await tickerRes.json())
      if (orderbookRes.ok) setOrderBook(await orderbookRes.json())
    } catch (err) {
      console.error('Market data error:', err)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password })
      })
      
      const data = await res.json()
      
      if (res.ok) {
        setMessage(`✅ Registered! User ID: ${data.user_id}`)
        setTimeout(() => setAuthMode('login'), 2000)
        setEmail('')
        setUsername('')
        setPassword('')
      } else {
        setMessage(`❌ ${data.detail || 'Registration failed'}`)
      }
    } catch (err) {
      setMessage(`❌ Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      
      const data = await res.json()
      
      if (res.ok) {
        localStorage.setItem('token', data.access_token)
        localStorage.setItem('username', username) 
        setToken(data.access_token)
        setMessage('✅ Logged in!')
        setEmail('')
        setPassword('')
        setUsername(username) 
      } else {
        setMessage(`❌ ${data.detail || 'Login failed'}`)
      }
    } catch (err) {
      setMessage(`❌ Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    setToken(null)
    setUsername('') 
    setOrders([])
    setMessage('✅ Logged out')
  }
  

  const handlePlaceOrder = async (e) => {
    e.preventDefault()
    if (!orderForm.price || !orderForm.quantity) {
      setMessage('❌ Fill in all fields')
      return
    }
  
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/trading/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          symbol: 'BTC-USDT',
          side: orderForm.side,
          order_type: 'limit',
          price: parseFloat(orderForm.price),
          quantity: parseFloat(orderForm.quantity)
        })
      })
  
      const data = await res.json()
  
      if (res.ok) {
        setMessage(`✅ Order placed! ID: ${data.order_id}`)
        setOrders([...orders, data])
        setOrderForm({ price: '', quantity: '', side: 'buy' })
        fetchMarketData()
      } else {
        setMessage(`❌ ${data.detail || 'Order failed'}`)
      }
    } catch (err) {
      console.error('Order error:', err)
      setMessage(`❌ Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }
  

  if (!token) {
    return (
      <div style={{
        padding: '40px',
        maxWidth: '400px',
        margin: '0 auto',
        marginTop: '50px'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>🚀 TrueCEX</h1>
          <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
            {authMode === 'login' ? 'Login' : 'Register'}
          </h2>
          
          <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} 
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              required
            />
            
            {authMode === 'register' && (
              <input
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                required
              />
            )}
            
            <input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              required
            />
            
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.6 : 1,
                marginTop: '10px'
              }}
            >
              {loading ? 'Loading...' : authMode === 'login' ? 'Login' : 'Register'}
            </button>
          </form>
          
          <button
            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            style={{
              marginTop: '15px',
              width: '100%',
              padding: '8px',
              backgroundColor: '#f3f4f6',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              cursor: 'pointer',
              color: '#3b82f6'
            }}
          >
            {authMode === 'login' ? 'Need to register?' : 'Already have account?'}
          </button>
          
          {message && (
            <div style={{
              marginTop: '15px',
              padding: '10px',
              backgroundColor: message.includes('❌') ? '#fee2e2' : '#dcfce7',
              color: message.includes('❌') ? '#b91c1c' : '#15803d',
              borderRadius: '4px',
              fontSize: '14px'
            }}>
              {message}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>🚀 TrueCEX - Trading Dashboard</h1>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{
            padding: '10px 16px',
            backgroundColor: '#dbeafe',
            borderRadius: '4px',
            border: '2px solid #3b82f6'
          }}>
            <span style={{ color: '#1e40af', fontWeight: 'bold', fontSize: '16px' }}>👤 {username}</span>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {message && (
        <div style={{
          padding: '10px',
          backgroundColor: message.includes('❌') ? '#fee2e2' : '#dcfce7',
          color: message.includes('❌') ? '#b91c1c' : '#15803d',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          {message}
        </div>
      )}

      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
        <div style={{
          padding: '15px',
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
          flex: 1,
          border: '1px solid #e5e7eb'
        }}>
          <h3>💰 BTC-USDT Price</h3>
          {ticker ? (
            <>
              <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6' }}>
                ${ticker.last_price?.toLocaleString()}
              </p>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>
                Bid: ${ticker.bid} | Ask: ${ticker.ask}
              </p>
            </>
          ) : (
            <p>Loading...</p>
          )}
        </div>

        <div style={{
          padding: '15px',
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
          flex: 1,
          border: '1px solid #e5e7eb'
        }}>
          <h3>📊 Order Book</h3>
          <p>Bids: {orderBook.bids?.length || 0} | Asks: {orderBook.asks?.length || 0}</p>
          <p>Spread: ${orderBook.spread?.toFixed(2) || 'N/A'}</p>
        </div>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h2>Order Book (BTC-USDT)</h2>
        <div style={{ display: 'flex', gap: '30px' }}>
          <div style={{ flex: 1 }}>
            <h3>📉 Bids (Buy Orders) - Green</h3>
            {orderBook.bids && orderBook.bids.length > 0 ? (
              <table style={{ width: '100%', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #10b981' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Price</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {orderBook.bids.map((bid, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '8px' }}>${bid.price?.toLocaleString()}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{bid.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No bids yet</p>
            )}
          </div>

          <div style={{ flex: 1 }}>
            <h3>📈 Asks (Sell Orders) - Red</h3>
            {orderBook.asks && orderBook.asks.length > 0 ? (
              <table style={{ width: '100%', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ef4444' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Price</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {orderBook.asks.map((ask, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '8px' }}>${ask.price?.toLocaleString()}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{ask.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No asks yet</p>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h2>Place Order</h2>
        <form onSubmit={handlePlaceOrder} style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          padding: '20px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <input
            placeholder="Price"
            type="number"
            step="0.01"
            value={orderForm.price}
            onChange={(e) => setOrderForm({ ...orderForm, price: e.target.value })}
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', flex: 1, minWidth: '120px' }}
          />
          <input
            placeholder="Quantity"
            type="number"
            step="0.001"
            value={orderForm.quantity}
            onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', flex: 1, minWidth: '120px' }}
          />
          <select
            value={orderForm.side}
            onChange={(e) => setOrderForm({ ...orderForm, side: e.target.value })}
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          >
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? 'Placing...' : 'Place Order'}
          </button>
        </form>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h2>Your Orders</h2>
        {orders.length === 0 ? (
          <p style={{ color: '#6b7280' }}>No orders yet. Start by placing an order above!</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Symbol</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Side</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Price</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Quantity</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '10px' }}>{order.symbol}</td>
                  <td style={{ padding: '10px' }}>{order.side}</td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>${order.price?.toLocaleString()}</td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>{order.quantity}</td>
                  <td style={{ padding: '10px' }}>{order.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{
        padding: '20px',
        backgroundColor: '#dcfce7',
        borderRadius: '8px',
        border: '1px solid #86efac'
      }}>
        <h3>✅ System Status</h3>
        <p>👤 Logged in as: <strong style={{ fontSize: '18px', color: '#15803d' }}>{username}</strong></p>
        <p>✅ Backend: http://127.0.0.1:8000</p>
        <p>✅ Frontend: http://localhost:5173</p>
      </div>

    </div>
  )
}
