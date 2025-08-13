"use client";

import { useState, useEffect } from 'react';

type OrderItem = {
  name: string;
  quantity: number;
  unit_cost?: number;
  price?: number;
};

interface Subscription {
  address: string;
  city: string;
  comments?: string;
  id?: string;
  createdAt: Date;
  userId: string;
  customerName: string;
  zipCode: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  status: 'active' | 'paused' | 'cancelled';
  frequency?: 'weekly';
  email: string;
  phone: string;
  items: OrderItem[];
  totalAmount?: number;
  stripeCustomerId: string;
  stripePaymentMethodId: string;
  stripeSetupIntentId: string;
  updatedAt?: Date;
}

interface SubscriptionsResponse {
  success: boolean;
  count: number;
  subscriptions: Subscription[];
}

interface Metrics {
  totalCount: number;
  totalWeeklyBreads: number;
  totalWeeklyRevenue: number;
}

export default function SubscriptionsList() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics>({
    totalCount: 0,
    totalWeeklyBreads: 0,
    totalWeeklyRevenue: 0
  });

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/subscriptions');
      const data: SubscriptionsResponse = await response.json();
      
      if (data.success) {
        console.log('Subscriptions data received:', data.subscriptions);
        setSubscriptions(data.subscriptions);
        calculateMetrics(data.subscriptions);
      } else {
        setError('Failed to fetch subscriptions');
      }
    } catch (err) {
      setError('Error loading subscriptions');
      console.error('Error fetching subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = (subs: Subscription[]) => {
    const activeSubscriptions = subs.filter(sub => sub.status === 'active');
    
    let totalWeeklyBreads = 0;
    let totalWeeklyRevenue = 0;

    activeSubscriptions.forEach(sub => {
      const items = sub.items || sub.items || [];
      const weeklyMultiplier = getWeeklyMultiplier(sub.frequency);
      
      items.forEach(item => {
        totalWeeklyBreads += item.quantity * weeklyMultiplier;
      });
      
      totalWeeklyRevenue += sub.totalAmount || 0 * weeklyMultiplier;
    });

    setMetrics({
      totalCount: activeSubscriptions.length,
      totalWeeklyBreads: Math.round(totalWeeklyBreads * 100) / 100, // Round to 2 decimal places
      totalWeeklyRevenue: Math.round(totalWeeklyRevenue * 100) / 100
    });
  };

  const getWeeklyMultiplier = (frequency?: string): number => {
    switch (frequency?.toLowerCase()) {
      case 'weekly':
        return 1;
      case 'bi-weekly':
      case 'biweekly':
        return 0.5;
      case 'monthly':
        return 0.25; // Assuming 4 weeks per month
      default:
        return 1; // Default to weekly
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusBadge = (subscription: Subscription) => {
    if (subscription.status !== 'active') {
      return (
        <span className="inline-block px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
          Inactive
        </span>
      );
    }
    return (
      <span className="inline-block px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
        Active
      </span>
    );
  };

  const getFrequencyBadge = (frequency?: string) => {
    const freq = frequency?.toLowerCase();
    let color = 'bg-blue-100 text-blue-800';
    
    switch (freq) {
      case 'weekly':
        color = 'bg-green-100 text-green-800';
        break;
      case 'bi-weekly':
      case 'biweekly':
        color = 'bg-yellow-100 text-yellow-800';
        break;
      case 'monthly':
        color = 'bg-purple-100 text-purple-800';
        break;
    }
    
    return (
      <span className={`inline-block px-2 py-1 text-xs rounded-full ${color}`}>
        {frequency || 'Weekly'}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-4 sm:p-8">
        <div className="text-lg text-gray-600">Loading subscriptions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center p-4 sm:p-8">
        <div className="text-lg text-red-600 mb-4">{error}</div>
        <button
          onClick={fetchSubscriptions}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-black">Subscriptions</h1>
          <button
            onClick={fetchSubscriptions}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            Refresh
          </button>
        </div>
        
        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-blue-600">Total Subscriptions</div>
            <div className="text-2xl font-bold text-blue-900">{metrics.totalCount}</div>
            <div className="text-xs text-blue-500">Active subscriptions</div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-green-600">Weekly Breads</div>
            <div className="text-2xl font-bold text-green-900">{metrics.totalWeeklyBreads}</div>
            <div className="text-xs text-green-500">Total breads per week</div>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-sm font-medium text-purple-600">Weekly Revenue</div>
            <div className="text-2xl font-bold text-purple-900">{formatCurrency(metrics.totalWeeklyRevenue)}</div>
            <div className="text-xs text-purple-500">Projected weekly revenue</div>
          </div>
        </div>
      </div>

      {/* Subscriptions List */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-black">
            All Subscriptions ({subscriptions.length})
          </h2>
        </div>
        
        {subscriptions.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-lg text-gray-600">No subscriptions found</div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {subscriptions.map((subscription) => (
              <div
                key={subscription.id}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                  {/* Customer Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold text-black">
                        Subscription #{subscription.id}
                      </h3>
                      {getStatusBadge(subscription)}
                      {getFrequencyBadge(subscription.frequency)}
                    </div>
                    
                    <div className="space-y-1 text-sm text-gray-600">
                      <p><strong>Customer:</strong> {subscription.customerName || 'No name provided'}</p>
                      <p><strong>Email:</strong> {subscription.email || 'No email provided'}</p>
                      <p><strong>Phone:</strong> {subscription.phone || 'No phone provided'}</p>
                      {/* <p><strong>Created:</strong> {subscription.createdAt.toLocaleDateString() || 'Unknown'}</p> */}
                    </div>
                    
                    {/* Delivery Address */}
                    {(subscription.address || subscription.city || subscription.zipCode) && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Delivery Address:</h4>
                        <div className="text-sm text-gray-600">
                          {subscription.address && <p>{subscription.address}</p>}
                          {(subscription.city || subscription.zipCode) && (
                            <p>
                              {subscription.city && subscription.city}
                              {subscription.city && subscription.zipCode && ', '}
                              {subscription.zipCode && subscription.zipCode}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Order Details */}
                  <div className="lg:text-right">
                    <div className="mb-3">
                      <p className="text-xl font-bold text-black">
                        {formatCurrency(subscription.totalAmount || 0)}
                      </p>
                      <p className="text-sm text-gray-500">
                        per {subscription.frequency || 'week'}
                      </p>
                    </div>
                    
                    {/* Items */}
                    <div className="space-y-1 text-sm">
                      {(subscription.items || subscription.items || []).map((item: OrderItem, index) => (
                        <div key={index} className="flex justify-between">
                          <span className="text-gray-700">
                            {item.name} x{item.quantity}
                          </span>
                          <span className="text-gray-600">
                            {formatCurrency(((item.unit_cost || item.price) || 0) * item.quantity)}
                          </span>
                        </div>
                      ))}
                      
                      {subscription.comments && (
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-gray-700">Comments</span>
                          <span className="text-gray-600">
                            {subscription.comments}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 