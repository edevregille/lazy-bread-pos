"use client";

import { useState, useEffect } from 'react';
import DeliveryMap from './DeliveryMap';

type OrderItem = {
  name: string;
  quantity: number;
  unit_cost?: number;
  price?: number;
};

interface Order {
  id: string;
  customer_email?: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  delivery_city?: string;
  delivery_zip_code?: string;
  total_amount: number;
  items?: OrderItem[];
  order_items?: OrderItem[];
  additional_charges?: number;
  created_at: string;
  payment_status?: string;
  s3_key?: string;
  s3_last_modified?: string;
  delivery_date?: string;
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
      // Use delivery_date if available, otherwise use created_at date
      const deliveryDate = order.delivery_date 
        ? new Date(order.delivery_date).toISOString().split('T')[0]
        : new Date(order.created_at).toISOString().split('T')[0];

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
      groups[deliveryDate].totalRevenue += order.total_amount;
      groups[deliveryDate].orders.push(order);

      // Aggregate bread quantities
      const items = order.items || order.order_items || [];
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
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
                {formatDate(selectedGroup.date)}
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
                            {order.customer_name || 'No name provided'}
                          </p>
                          <p className="text-xs lg:text-sm text-gray-500">
                            {order.customer_email || 'No email provided'}
                          </p>
                          <p className="text-xs lg:text-sm text-gray-500">
                            {order.customer_phone || 'No phone provided'}
                          </p>
                          <p className="text-xs lg:text-sm text-gray-500">
                            {new Date(order.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-lg lg:text-xl font-bold text-black">
                          {formatCurrency(order.total_amount)}
                        </p>
                        {order.payment_status && (
                          <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${
                            order.payment_status === 'succeeded' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {order.payment_status}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Delivery Address */}
                    {(order.delivery_address || order.delivery_city || order.delivery_zip_code) && (
                      <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                        <h5 className="text-xs lg:text-sm font-medium text-gray-700 mb-1">Delivery Address:</h5>
                        <div className="text-xs lg:text-sm text-gray-600">
                          {order.delivery_address && <p>{order.delivery_address}</p>}
                          {(order.delivery_city || order.delivery_zip_code) && (
                            <p>
                              {order.delivery_city && order.delivery_city}
                              {order.delivery_city && order.delivery_zip_code && ', '}
                              {order.delivery_zip_code && order.delivery_zip_code}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-1 lg:space-y-2">
                      {(order.items || order.order_items || []).map((item: OrderItem, index) => (
                        <div key={index} className="flex justify-between text-xs lg:text-sm">
                          <span className="text-gray-700">
                            {item.name} x{item.quantity}
                          </span>
                          <span className="text-gray-600">
                            {formatCurrency(((item.unit_cost || item.price) || 0) * item.quantity)}
                          </span>
                        </div>
                      ))}
                      
                      {order.additional_charges && order.additional_charges > 0 && (
                        <div className="flex justify-between text-xs lg:text-sm border-t pt-2">
                          <span className="text-gray-700">Additional Charges</span>
                          <span className="text-gray-600">
                            {formatCurrency(order.additional_charges)}
                          </span>
                        </div>
                      )}
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