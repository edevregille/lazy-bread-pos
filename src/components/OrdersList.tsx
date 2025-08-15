"use client";

import { useState, useEffect } from 'react';
import DeliveryMap from './DeliveryMap';
import {
   markOrderAsDelivered, 
   Result, 
   getPaymentIntentStatus, 
   capturePayment,
   formatDeliveryDate,
} from '@/lib/deliveryService';

type OrderItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
};

interface Order {
  id: string;
  items: OrderItem[];
  orderType: 'online' | 'subscription' | 'in-person';
  deliveryDate: string;
  address: string;
  city: string;
  zipCode: string;
  customerName: string;
  email: string;
  phone: string;
  comments: string;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'delivered' | 'cancelled';
  createdAt: Date;
  userId?: string;
  stripeCustomerId: string;
  stripePaymentIntentId: string;
  stripePaymentStatus: string;
}

interface OrdersResponse {
  success: boolean;
  count: number;
  orders: Order[];
}

interface DeliveryDateSummary {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  breadSummary: { [key: string]: number };
  orders: Order[];
}

export default function OrdersList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState<string | null>(null);
  const [deliveryDateGroups, setDeliveryDateGroups] = useState<DeliveryDateSummary[]>([]);
  const [deliveringOrders, setDeliveringOrders] = useState<Set<string>>(new Set());
  const [deliveryMessages, setDeliveryMessages] = useState<Record<string, string>>({});
  const [capturingPayments, setCapturingPayments] = useState<Set<string>>(new Set());
  const [captureMessages, setCaptureMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (orders.length > 0) {
      const groups = groupOrdersByDeliveryDate(orders);
      setDeliveryDateGroups(groups);
      if (groups.length > 0 && !selectedDeliveryDate) {
        setSelectedDeliveryDate(groups[0].date);
      }
    }
  }, [orders]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/orders');
      const data: OrdersResponse = await response.json();
      
      if (data.success) {
        console.log('Orders data received:', data.orders);
        // Log a sample order to see the date format
        if (data.orders.length > 0) {
          const ordersWithStatus = await fetchPaymentsStatus(data.orders);
          console.log('Orders with status fetched:', ordersWithStatus);
          setOrders(ordersWithStatus);
        } else {
          setOrders(data.orders);
        }
      } else {
        setError('Failed to fetch orders');
      }
    } catch (err) {
      setError('Error loading orders');
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentsStatus = async (orders: Order[]) => {
    const ordersWithStatusPromises = orders.map(async (order) => {
      if (order.stripePaymentIntentId) {
        return { ...order, stripePaymentStatus: await getPaymentIntentStatus(order.stripePaymentIntentId) };
      }
      return order;
    });
    return await Promise.all(ordersWithStatusPromises);
  };

  const groupOrdersByDeliveryDate = (orders: Order[]): DeliveryDateSummary[] => {
    const groups: { [key: string]: DeliveryDateSummary } = {};

    orders.forEach(order => {
      // Helper function to safely parse dates
      const parseDate = (dateString: string): string => {
        
        try {
          // const date = new Date(dateString);
          // // Check if the date is valid
          // if (isNaN(date.getTime())) {
          //   console.warn(`Invalid date format: ${dateString}, using today's date`);
          //   return new Date().toISOString().split('T')[0];
          // }
          return formatDeliveryDate(dateString);
        } catch (error) {
          console.warn(`Error parsing date: ${dateString}, using today's date`, error);
          return new Date().toISOString().split('T')[0];
        }
      };

      // Use delivery_date if available, otherwise use created_at date
      const deliveryDate = parseDate(order.deliveryDate);

      if (!groups[deliveryDate]) {
        groups[deliveryDate] = {
          date: deliveryDate,
          totalOrders: 0,
          totalRevenue: 0,
          breadSummary: {},
          orders: []
        };
      }

      groups[deliveryDate].totalOrders++;
      groups[deliveryDate].totalRevenue += order.totalAmount;
      groups[deliveryDate].orders.push(order);

      // Aggregate bread quantities
      const items = order.items || order.items || [];
      items.forEach(item => {
        if (!groups[deliveryDate].breadSummary[item.name]) {
          groups[deliveryDate].breadSummary[item.name] = 0;
        }
        groups[deliveryDate].breadSummary[item.name] += item.quantity;
      });
    });

    // Sort by date (newest first)
    return Object.values(groups).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const formatShortDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.warn(`Error formatting short date: ${dateString}`, error);
      return 'Invalid Date';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getTotalBreadCount = (breadSummary: { [key: string]: number }) => {
    return Object.values(breadSummary).reduce((total, quantity) => total + quantity, 0);
  };

  const handleMarkAsDelivered = async (order: Order) => {
    if (deliveringOrders.has(order.id)) return;

    setDeliveringOrders(prev => new Set(prev).add(order.id));
    setDeliveryMessages(prev => ({ ...prev, [order.id]: '' }));

    try {
      const result: Result = await markOrderAsDelivered(order.id);
      
      if (result.success) {
        setDeliveryMessages(prev => ({ 
          ...prev, 
          [order.id]: 'Order marked as delivered successfully!' 
        }));
        
        // Refresh orders to show updated status
        setTimeout(() => {
          fetchOrders();
          setDeliveryMessages(prev => {
            const newMessages = { ...prev };
            delete newMessages[order.id];
            return newMessages;
          });
        }, 2000);
      } else {
        setDeliveryMessages(prev => ({ 
          ...prev, 
          [order.id]: `Error: ${result.error}` 
        }));
      }
    } catch (error) {
      setDeliveryMessages(prev => ({ 
        ...prev, 
        [order.id]: `Error: ${error instanceof Error ? error.message : 'Failed to mark as delivered'}` 
      }));
    } finally {
      setDeliveringOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(order.id);
        return newSet;
      });
    }
  };

  const handleCapturePayment = async (order: Order) => {
    if (capturingPayments.has(order.id) || !order.stripePaymentIntentId) return;

    setCapturingPayments(prev => new Set(prev).add(order.id));
    setCaptureMessages(prev => ({ ...prev, [order.id]: '' }));

    try {
      const result: Result = await capturePayment(order.stripePaymentIntentId);
      
      if (result.success) {
        setCaptureMessages(prev => ({ 
          ...prev, 
          [order.id]: 'Payment captured successfully!' 
        }));

        // Refresh orders to show updated payment status
        setTimeout(() => {
          fetchOrders();
          setCaptureMessages(prev => {
            const newMessages = { ...prev };
            delete newMessages[order.id];
            return newMessages;
          });
        }, 2000);
      } else {
        setCaptureMessages(prev => ({ 
          ...prev, 
          [order.id]: `Error: ${result.error}` 
        }));
      }
    } catch (error) {
      setCaptureMessages(prev => ({ 
        ...prev, 
        [order.id]: `Error: ${error instanceof Error ? error.message : 'Failed to capture payment'}` 
      }));
    } finally {
      setCapturingPayments(prev => {
        const newSet = new Set(prev);
        newSet.delete(order.id);
        return newSet;
      });
    }
  };

  const selectedGroup = deliveryDateGroups.find(group => group.date === selectedDeliveryDate);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-4 sm:p-8">
        <div className="text-lg text-gray-600">Loading orders...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center p-4 sm:p-8">
        <div className="text-lg text-red-600 mb-4">{error}</div>
        <button
          onClick={fetchOrders}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex justify-center items-center p-4 sm:p-8">
        <div className="text-lg text-gray-600">No orders found</div>
      </div>
    );
  }

  console.log(orders);

  return (
    <div className="flex flex-col lg:flex-row h-full gap-4 lg:gap-6">
      {/* Delivery Date Navigation - Mobile: Horizontal scroll, Desktop: Sidebar */}
      <div className="lg:w-64 bg-white rounded-lg shadow-md p-4 order-1 lg:order-1">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-black">Delivery Dates</h3>
          <button
            onClick={fetchOrders}
            className="px-2 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
          >
            Refresh
          </button>
        </div>
        
        {/* Mobile: Horizontal scrollable list */}
        <div className="lg:hidden overflow-x-auto pb-2">
          <div className="flex space-x-2 min-w-max">
            {deliveryDateGroups.map((group) => (
              <button
                key={group.date}
                onClick={() => setSelectedDeliveryDate(group.date)}
                className={`flex-shrink-0 p-3 rounded-lg transition-colors whitespace-nowrap ${
                  selectedDeliveryDate === group.date
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <div className="font-medium">{formatShortDate(group.date)}</div>
                <div className="text-xs opacity-75">
                  {group.totalOrders} orders • {getTotalBreadCount(group.breadSummary)} bread
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Desktop: Vertical list */}
        <div className="hidden lg:block space-y-2">
          {deliveryDateGroups.map((group) => (
            <button
              key={group.date}
              onClick={() => setSelectedDeliveryDate(group.date)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                selectedDeliveryDate === group.date
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <div className="font-medium">{formatShortDate(group.date)}</div>
              <div className="text-sm opacity-75">
                {group.totalOrders} orders • {getTotalBreadCount(group.breadSummary)} bread • {formatCurrency(group.totalRevenue)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 order-2 lg:order-2">
        {selectedGroup && (
          <div className="space-y-4 lg:space-y-6">
            {/* Header */}
            <div className="bg-white p-4 lg:p-6 rounded-lg shadow-md">
              <h2 className="text-xl lg:text-2xl font-bold text-black mb-2">
                {selectedGroup.date}
              </h2>
              <p className="text-sm lg:text-base text-gray-600">
                {selectedGroup.totalOrders} orders • {getTotalBreadCount(selectedGroup.breadSummary)} bread • {formatCurrency(selectedGroup.totalRevenue)} total revenue
              </p>
            </div>

            {/* Summary Statistics */}
            <div className="bg-white p-4 lg:p-6 rounded-lg shadow-md">
              <h3 className="text-lg lg:text-xl font-semibold text-black mb-4">Bread Summary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                {Object.entries(selectedGroup.breadSummary).map(([breadName, quantity]) => (
                  <div key={breadName} className="bg-gray-50 p-3 lg:p-4 rounded-lg">
                    <div className="font-medium text-black text-sm lg:text-base">{breadName}</div>
                    <div className="text-xl lg:text-2xl font-bold text-blue-600">{quantity}</div>
                    <div className="text-xs lg:text-sm text-gray-500">units ordered</div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Delivery Map */}
            <DeliveryMap orders={selectedGroup.orders} deliveryDate={selectedGroup.date} />

            {/* Orders List */}
            <div className="bg-white p-4 lg:p-6 rounded-lg shadow-md">
              <h3 className="text-lg lg:text-xl font-semibold text-black mb-4">
                Orders ({selectedGroup.orders.length})
              </h3>
              
              <div className="space-y-3 lg:space-y-4">
                {selectedGroup.orders.map((order) => (
                  <div
                    key={order.id}
                    className="border border-gray-200 p-3 lg:p-4 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
                      <div className="flex-1">
                        <h4 className="text-base lg:text-lg font-semibold text-black">
                          Order #{order.id}
                        </h4>
                        <div className="space-y-1 mt-1">
                          <p className="text-xs lg:text-sm text-gray-500">
                            {order.customerName || 'No name provided'}
                          </p>
                          <p className="text-xs lg:text-sm text-gray-500">
                            {order.email || 'No email provided'}
                          </p>
                          <p className="text-xs lg:text-sm text-gray-500">
                            {order.phone || 'No phone provided'}
                          </p>
                          <p className="text-xs lg:text-sm text-gray-500">
                            {/* {order.createdAt ? order.createdAt.toLocaleDateString() : 'Unknown'} */}
                          </p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-lg lg:text-xl font-bold text-black">
                          {formatCurrency(order.totalAmount)}
                        </p>
                        {order.status && (
                          <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${
                            order.status === 'delivered' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            delivery:{order.status}
                          </span>
                        )}
                        {order.stripePaymentStatus && (
                          <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${
                            order.stripePaymentStatus === 'succeeded' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            payment:{order.stripePaymentStatus}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Delivery Address */}
                    {(order.address || order.city || order.zipCode) && (
                      <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                        <h5 className="text-xs lg:text-sm font-medium text-gray-700 mb-1">Delivery Address:</h5>
                        <div className="text-xs lg:text-sm text-gray-600">
                          {order.address && <p>{order.address}</p>}
                          {(order.city || order.zipCode) && (
                            <p>
                              {order.city && order.city}
                              {order.city && order.zipCode && ', '}
                              {order.zipCode && order.zipCode}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-1 lg:space-y-2">
                      {(order.items || order.items || []).map((item: OrderItem, index) => (
                        <div key={index} className="flex justify-between text-xs lg:text-sm">
                          <span className="text-gray-700">
                            {item.name} x{item.quantity}
                          </span>
                          <span className="text-gray-600">
                            {formatCurrency(item.price || 0 * item.quantity || 0)}
                          </span>
                        </div>
                      ))}
                      
                      {order.comments && (
                        <div className="flex justify-between text-xs lg:text-sm border-t pt-2">
                          <span className="text-gray-700">Comments</span>
                          <span className="text-gray-600">
                            {order.comments}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Payment and Delivery Actions */}
                    <div className="mt-4 pt-3 border-t border-gray-200">
                      <div className="space-y-3">
                        {/* Messages */}
                        <div className="space-y-1">
                          {deliveryMessages[order.id] && (
                            <div className={`text-sm ${
                              deliveryMessages[order.id].startsWith('Error') 
                                ? 'text-red-600' 
                                : 'text-green-600'
                            }`}>
                              {deliveryMessages[order.id]}
                            </div>
                          )}
                          {captureMessages[order.id] && (
                            <div className={`text-sm ${
                              captureMessages[order.id].startsWith('Error') 
                                ? 'text-red-600' 
                                : 'text-green-600'
                            }`}>
                              {captureMessages[order.id]}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-2">
                          {/* Capture Payment Button */}
                          {order.stripePaymentIntentId && (
                            <button
                              onClick={() => handleCapturePayment(order)}
                              disabled={capturingPayments.has(order.id) || order.stripePaymentStatus === 'succeeded'}
                              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                order.stripePaymentStatus === 'succeeded'
                                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                  : capturingPayments.has(order.id)
                                  ? 'bg-blue-300 text-white cursor-not-allowed'
                                  : 'bg-blue-500 text-white hover:bg-blue-600'
                              }`}
                            >
                              {capturingPayments.has(order.id) ? (
                                <span className="flex items-center justify-center gap-2">
                                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                  Capturing...
                                </span>
                              ) : order.stripePaymentStatus === 'succeeded' ? (
                                'Payment Captured ✓'
                              ) : (
                                'Capture Payment'
                              )}
                            </button>
                          )}

                          {/* Mark as Delivered Button */}
                          <button
                            onClick={() => handleMarkAsDelivered(order)}
                            disabled={deliveringOrders.has(order.id) || order.status === 'delivered'}
                            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                              order.status === 'delivered'
                                ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                : deliveringOrders.has(order.id)
                                ? 'bg-blue-300 text-white cursor-not-allowed'
                                : 'bg-green-500 text-white hover:bg-green-600'
                            }`}
                          >
                            {deliveringOrders.has(order.id) ? (
                              <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Processing...
                              </span>
                            ) : order.status === 'delivered' ? (
                              'Delivered ✓'
                            ) : (
                              'Mark as Delivered'
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 