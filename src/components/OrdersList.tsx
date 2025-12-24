"use client";

import { useState, useEffect } from 'react';
import DeliveryMap from './DeliveryMap';
import {
   markOrderAsDelivered, 
   Result, 
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
  stripePaymentIntentId?: string | null;
  stripeSetupIntentId?: string;
  stripePaymentMethodId?: string;
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
        // Use orders directly from Firebase - they already have stripePaymentStatus
        setOrders(data.orders);
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
    if (capturingPayments.has(order.id)) return;

    // Check if we have the required information for payment capture
    if (!order.stripePaymentIntentId && (!order.stripeCustomerId || !order.stripePaymentMethodId)) {
      setCaptureMessages(prev => ({ 
        ...prev, 
        [order.id]: 'Error: Missing payment information. Cannot capture payment.' 
      }));
      return;
    }

    setCapturingPayments(prev => new Set(prev).add(order.id));
    setCaptureMessages(prev => ({ ...prev, [order.id]: '' }));

    try {
      const result: Result = await capturePayment(
        order.stripePaymentIntentId || undefined,
        order.stripeCustomerId,
        order.stripePaymentMethodId || undefined,
        order.totalAmount,
        order.id
      );
      
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
        <div className="text-lg sm:text-xl font-semibold text-gray-600">Loading orders...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center p-4 sm:p-8">
        <div className="bg-white/90 backdrop-blur-sm p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-200/50 text-center">
          <div className="text-lg sm:text-xl font-semibold text-red-600 mb-4">{error}</div>
          <button
            onClick={fetchOrders}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex justify-center items-center p-4 sm:p-8">
        <div className="bg-white/90 backdrop-blur-sm p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-200/50">
          <div className="text-lg sm:text-xl font-semibold text-gray-600">No orders found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-full gap-4 sm:gap-5 lg:gap-6">
      {/* Delivery Date Navigation - Mobile: Horizontal scroll, Desktop: Sidebar */}
      <div className="lg:w-64 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-4 sm:p-5 order-1 lg:order-1">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900">Delivery Dates</h3>
          <button
            onClick={fetchOrders}
            className="px-3 py-1.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md hover:shadow-lg transition-all duration-200 active:scale-95"
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
                className={`flex-shrink-0 p-3 sm:p-4 rounded-xl transition-all duration-200 whitespace-nowrap shadow-md hover:shadow-lg active:scale-95 ${
                  selectedDeliveryDate === group.date
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-blue-500/30'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200/50'
                }`}
              >
                <div className="font-semibold text-sm sm:text-base">{formatShortDate(group.date)}</div>
                <div className="text-xs opacity-75 mt-1">
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
              className={`w-full text-left p-3 sm:p-4 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 ${
                selectedDeliveryDate === group.date
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-blue-500/30'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200/50'
              }`}
            >
              <div className="font-semibold text-sm sm:text-base">{formatShortDate(group.date)}</div>
              <div className="text-xs sm:text-sm opacity-75 mt-1">
                {group.totalOrders} orders • {getTotalBreadCount(group.breadSummary)} bread • {formatCurrency(group.totalRevenue)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 order-2 lg:order-2">
        {selectedGroup && (
          <div className="space-y-4 sm:space-y-5 lg:space-y-6">
            {/* Header */}
            <div className="bg-white/90 backdrop-blur-sm p-5 sm:p-6 rounded-2xl shadow-lg border border-gray-200/50">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
                {selectedGroup.date}
              </h2>
              <p className="text-sm sm:text-base lg:text-lg text-gray-600">
                {selectedGroup.totalOrders} orders • {getTotalBreadCount(selectedGroup.breadSummary)} bread • {formatCurrency(selectedGroup.totalRevenue)} total revenue
              </p>
            </div>

            {/* Summary Statistics */}
            <div className="bg-white/90 backdrop-blur-sm p-5 sm:p-6 rounded-2xl shadow-lg border border-gray-200/50">
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-4 sm:mb-5">Bread Summary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
                {Object.entries(selectedGroup.breadSummary).map(([breadName, quantity]) => (
                  <div key={breadName} className="bg-gradient-to-br from-gray-50 to-white p-4 sm:p-5 rounded-xl border border-gray-200/50 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
                    <div className="font-semibold text-gray-700 text-sm sm:text-base mb-2">{breadName}</div>
                    <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-1">{quantity}</div>
                    <div className="text-xs sm:text-sm text-gray-500">units ordered</div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Delivery Map */}
            <DeliveryMap orders={selectedGroup.orders} deliveryDate={selectedGroup.date} />

            {/* Orders List */}
            <div className="bg-white/90 backdrop-blur-sm p-5 sm:p-6 rounded-2xl shadow-lg border border-gray-200/50">
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-4 sm:mb-5">
                Orders ({selectedGroup.orders.length})
              </h3>
              
              <div className="space-y-3 sm:space-y-4">
                {selectedGroup.orders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-white/80 backdrop-blur-sm border-2 border-gray-200/50 p-4 sm:p-5 rounded-xl shadow-md hover:shadow-lg hover:scale-[1.01] transition-all duration-200"
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-base lg:text-lg font-semibold text-black">
                            Order #{order.id}
                          </h4>
                          {/* Payment Method Status Icon */}
                          {order.stripeCustomerId && order.stripePaymentMethodId ? (
                            <svg 
                              className="w-5 h-5 text-green-600" 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                              title="Ready to collect payment"
                            >
                              <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={2} 
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                              />
                            </svg>
                          ) : (
                            <svg 
                              className="w-5 h-5 text-amber-600" 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                              title="This order does not have payment information to allow to collect a payment"
                            >
                              <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={2} 
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                              />
                            </svg>
                          )}
                        </div>
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
                          <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full mt-1 shadow-sm ${
                            order.status === 'delivered' 
                              ? 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 border border-green-300/50' 
                              : 'bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border border-yellow-300/50'
                          }`}>
                            delivery:{order.status}
                          </span>
                        )}
                        {order.stripePaymentStatus && (
                          <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full mt-1 shadow-sm ${
                            order.stripePaymentStatus === 'succeeded' 
                              ? 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 border border-green-300/50' 
                              : 'bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border border-yellow-300/50'
                          }`}>
                            payment:{order.stripePaymentStatus}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Delivery Address */}
                    {(order.address || order.city || order.zipCode) && (
                      <div className="mb-3 p-3 sm:p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200/50">
                        <h5 className="text-xs sm:text-sm font-semibold text-gray-700 mb-1">Delivery Address:</h5>
                        <div className="text-xs sm:text-sm text-gray-600">
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
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                          {/* Capture Payment Button */}
                          {(order.stripePaymentIntentId || (order.stripeCustomerId && order.stripePaymentMethodId)) && (
                            <button
                              onClick={() => handleCapturePayment(order)}
                              disabled={capturingPayments.has(order.id) || order.stripePaymentStatus === 'succeeded'}
                              className={`flex-1 px-4 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-semibold transition-all duration-200 active:scale-95 shadow-md hover:shadow-lg ${
                                order.stripePaymentStatus === 'succeeded'
                                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                  : capturingPayments.has(order.id)
                                  ? 'bg-blue-300 text-white cursor-not-allowed'
                                  : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white'
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
                                'Collect Payment'
                              )}
                            </button>
                          )}

                          {/* Mark as Delivered Button */}
                          <button
                            onClick={() => handleMarkAsDelivered(order)}
                            disabled={deliveringOrders.has(order.id) || order.status === 'delivered'}
                            className={`flex-1 px-4 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-semibold transition-all duration-200 active:scale-95 shadow-md hover:shadow-lg ${
                              order.status === 'delivered'
                                ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                : deliveringOrders.has(order.id)
                                ? 'bg-green-300 text-white cursor-not-allowed'
                                : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white'
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