import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../services/api';
import toast from 'react-hot-toast';

const TradingPage = () => {
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [] });
  const [symbol, setSymbol] = useState('BTC-USDT');
  const [orderType, setOrderType] = useState('limit');
  const [side, setSide] = useState('buy');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [recentTrades, setRecentTrades] = useState([]);
  const [userOrders, setUserOrders] = useState([]);

  // Fetch order book
  useEffect(() => {
    const fetchOrderBook = async () => {
      try {
        const response = await api.get(`/market/orderbook/${symbol}`);
        setOrderBook(response.data);
      } catch (error) {
        console.error('Failed to fetch order book', error);
      }
    };

    fetchOrderBook();
    const interval = setInterval(fetchOrderBook, 2000);
    return () => clearInterval(interval);
  }, [symbol]);

  // Fetch user orders
  useEffect(() => {
    const fetchUserOrders = async () => {
      try {
        const response = await api.get('/trading/orders', {
          params: { symbol, limit: 10 }
        });
        setUserOrders(response.data);
      } catch (error) {
        console.error('Failed to fetch orders', error);
      }
    };

    fetchUserOrders();
  }, [symbol]);

  // Place order
  const handlePlaceOrder = async (e) => {
    e.preventDefault();

    try {
      const orderData = {
        symbol,
        side,
        order_type: orderType,
        quantity: parseFloat(quantity),
      };

      if (orderType === 'limit') {
        orderData.price = parseFloat(price);
      }

      const response = await api.post('/trading/orders', orderData);
      
      toast.success(`Order placed successfully: ${response.data.order_id}`);
      
      // Reset form
      setPrice('');
      setQuantity('');
      
      // Refresh orders
      const ordersResponse = await api.get('/trading/orders', {
        params: { symbol, limit: 10 }
      });
      setUserOrders(ordersResponse.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to place order');
    }
  };

  // Cancel order
  const handleCancelOrder = async (orderId) => {
    try {
      await api.delete(`/trading/orders/${orderId}`);
      toast.success('Order cancelled successfully');
      
      // Refresh orders
      const response = await api.get('/trading/orders', {
        params: { symbol, limit: 10 }
      });
      setUserOrders(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel order');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">True CEX - Trading</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Order Book */}
          <div className="lg:col-span-1 bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4">Order Book - {symbol}</h2>
            
            {/* Asks (Sell Orders) */}
            <div className="mb-4">
              <h3 className="text-sm text-red-400 mb-2">Asks</h3>
              <div className="space-y-1">
                {orderBook.asks.slice(0, 10).map((ask, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-red-400">{ask.price.toFixed(2)}</span>
                    <span className="text-gray-400">{ask.quantity.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Spread */}
            {orderBook.spread && (
              <div className="my-2 text-center text-sm text-gray-500">
                Spread: ${orderBook.spread.toFixed(2)}
              </div>
            )}

            {/* Bids (Buy Orders) */}
            <div>
              <h3 className="text-sm text-green-400 mb-2">Bids</h3>
              <div className="space-y-1">
                {orderBook.bids.slice(0, 10).map((bid, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-green-400">{bid.price.toFixed(2)}</span>
                    <span className="text-gray-400">{bid.quantity.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Trading Panel */}
          <div className="lg:col-span-2">
            {/* Order Form */}
            <div className="bg-gray-800 rounded-lg p-6 mb-4">
              <h2 className="text-xl font-semibold mb-4">Place Order</h2>
              
              <form onSubmit={handlePlaceOrder}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Buy/Sell Tabs */}
                  <div className="col-span-2 flex gap-2">
                    <button
                      type="button"
                      className={`flex-1 py-2 rounded ${
                        side === 'buy'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-700 text-gray-400'
                      }`}
                      onClick={() => setSide('buy')}
                    >
                      Buy
                    </button>
                    <button
                      type="button"
                      className={`flex-1 py-2 rounded ${
                        side === 'sell'
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-700 text-gray-400'
                      }`}
                      onClick={() => setSide('sell')}
                    >
                      Sell
                    </button>
                  </div>

                  {/* Order Type */}
                  <div className="col-span-2">
                    <label className="block text-sm mb-2">Order Type</label>
                    <select
                      value={orderType}
                      onChange={(e) => setOrderType(e.target.value)}
                      className="w-full bg-gray-700 rounded px-3 py-2"
                    >
                      <option value="limit">Limit</option>
                      <option value="market">Market</option>
                    </select>
                  </div>

                  {/* Price */}
                  {orderType === 'limit' && (
                    <div className="col-span-2">
                      <label className="block text-sm mb-2">Price (USDT)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full bg-gray-700 rounded px-3 py-2"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  )}

                  {/* Quantity */}
                  <div className="col-span-2">
                    <label className="block text-sm mb-2">Quantity (BTC)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full bg-gray-700 rounded px-3 py-2"
                      placeholder="0.0000"
                      required
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="col-span-2">
                    <button
                      type="submit"
                      className={`w-full py-3 rounded font-semibold ${
                        side === 'buy'
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      {side === 'buy' ? 'Buy' : 'Sell'} {symbol.split('-')[0]}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Open Orders */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Your Orders</h2>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-gray-400 border-b border-gray-700">
                    <tr>
                      <th className="text-left py-2">Time</th>
                      <th className="text-left py-2">Side</th>
                      <th className="text-right py-2">Price</th>
                      <th className="text-right py-2">Quantity</th>
                      <th className="text-right py-2">Filled</th>
                      <th className="text-left py-2">Status</th>
                      <th className="text-center py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userOrders.map((order) => (
                      <tr key={order.order_id} className="border-b border-gray-700">
                        <td className="py-2">
                          {new Date(order.created_at).toLocaleTimeString()}
                        </td>
                        <td className={order.side === 'buy' ? 'text-green-400' : 'text-red-400'}>
                          {order.side.toUpperCase()}
                        </td>
                        <td className="text-right">{order.price.toFixed(2)}</td>
                        <td className="text-right">{order.quantity.toFixed(4)}</td>
                        <td className="text-right">{order.filled_quantity.toFixed(4)}</td>
                        <td>
                          <span className={`px-2 py-1 rounded text-xs ${
                            order.status === 'filled' ? 'bg-green-900 text-green-300' :
                            order.status === 'partial' ? 'bg-yellow-900 text-yellow-300' :
                            order.status === 'cancelled' ? 'bg-red-900 text-red-300' :
                            'bg-gray-700 text-gray-300'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="text-center">
                          {order.status === 'pending' || order.status === 'partial' ? (
                            <button
                              onClick={() => handleCancelOrder(order.order_id)}
                              className="text-red-400 hover:text-red-300 text-xs"
                            >
                              Cancel
                            </button>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {userOrders.length === 0 && (
                      <tr>
                        <td colSpan="7" className="text-center py-4 text-gray-500">
                          No orders found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradingPage;
