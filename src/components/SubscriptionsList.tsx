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
  weeklyBreadsByDay: {
    [key: string]: number;
  };
}

export default function SubscriptionsList() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics>({
    totalCount: 0,
    totalWeeklyBreads: 0,
    totalWeeklyRevenue: 0,
    weeklyBreadsByDay: {}
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
    const weeklyBreadsByDay: { [key: string]: number } = {};

    activeSubscriptions.forEach(sub => {
      const items = sub.items || sub.items || [];
      const weeklyMultiplier = getWeeklyMultiplier(sub.frequency);
      
      let subscriptionWeeklyBreads = 0;
      items.forEach(item => {
        subscriptionWeeklyBreads += item.quantity * weeklyMultiplier;
      });
      
      totalWeeklyBreads += subscriptionWeeklyBreads;
      totalWeeklyRevenue += sub.totalAmount || 0 * weeklyMultiplier;

      // Add to day breakdown
      weeklyBreadsByDay[sub.dayOfWeek] = (weeklyBreadsByDay[sub.dayOfWeek] || 0) + subscriptionWeeklyBreads;
    });

    setMetrics({
      totalCount: activeSubscriptions.length,
      totalWeeklyBreads: Math.round(totalWeeklyBreads * 100) / 100, // Round to 2 decimal places
      totalWeeklyRevenue: Math.round(totalWeeklyRevenue * 100) / 100,
      weeklyBreadsByDay: weeklyBreadsByDay
    });
  };
  console.log(metrics);
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
        <div className="text-lg sm:text-xl font-semibold text-gray-600">Loading subscriptions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center p-4 sm:p-8">
        <div className="bg-white/90 backdrop-blur-sm p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-200/50 text-center">
          <div className="text-lg sm:text-xl font-semibold text-red-600 mb-4">{error}</div>
          <button
            onClick={fetchSubscriptions}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5 lg:space-y-6">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm p-5 sm:p-6 rounded-2xl shadow-lg border border-gray-200/50">
        <div className="flex justify-between items-center mb-4 sm:mb-5">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Subscriptions</h1>
          <button
            onClick={fetchSubscriptions}
            className="px-4 py-2 sm:px-5 sm:py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl text-sm sm:text-base shadow-md hover:shadow-lg transition-all duration-200 active:scale-95"
          >
            Refresh
          </button>
        </div>
        
        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 sm:p-5 rounded-xl border border-blue-200/50 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
            <div className="text-sm sm:text-base font-semibold text-blue-600 mb-1">Total Active Subscriptions</div>
            <div className="text-2xl sm:text-3xl font-bold text-blue-900 mb-1">{metrics.totalCount}</div>
            <div className="text-xs sm:text-sm text-blue-500">Active subscriptions</div>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-green-100/50 p-4 sm:p-5 rounded-xl border border-green-200/50 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
            <div className="text-sm sm:text-base font-semibold text-green-600 mb-1">Weekly Breads</div>
            <div className="text-2xl sm:text-3xl font-bold text-green-900 mb-1">{metrics.totalWeeklyBreads}</div>
            <div className="text-xs sm:text-sm text-green-500">Total breads per week</div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 p-4 sm:p-5 rounded-xl border border-purple-200/50 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
            <div className="text-sm sm:text-base font-semibold text-purple-600 mb-1">Weekly Revenue</div>
            <div className="text-2xl sm:text-3xl font-bold text-purple-900 mb-1">{formatCurrency(metrics.totalWeeklyRevenue)}</div>
            <div className="text-xs sm:text-sm text-purple-500">Projected weekly revenue</div>
          </div>
        </div>

        {/* Weekly Breads Breakdown by Day */}
        {Object.keys(metrics.weeklyBreadsByDay).length > 0 && (
          <div className="mt-4 sm:mt-5">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Weekly Breads by Delivery Day</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
              {Object.keys(metrics.weeklyBreadsByDay).map((day) => {
                const breadCount = metrics.weeklyBreadsByDay[day] || 0;
                return (
                  <div key={day} className={`p-3 sm:p-4 rounded-xl text-center shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02] ${breadCount > 0 ? 'bg-gradient-to-br from-orange-50 to-orange-100/50 border-2 border-orange-200' : 'bg-gradient-to-br from-gray-50 to-gray-100/50 border-2 border-gray-200'}`}>
                    <div className="text-sm sm:text-base font-semibold text-gray-600 mb-1">{day}</div>
                    <div className={`text-xl sm:text-2xl font-bold mb-1 ${breadCount > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                      {breadCount}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-500">breads</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Subscriptions List */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-gray-200/50 bg-gradient-to-r from-gray-50/50 to-white">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            All Subscriptions ({subscriptions.length})
          </h2>
        </div>
        
        {subscriptions.length === 0 ? (
          <div className="p-8 sm:p-10 text-center">
            <div className="text-lg sm:text-xl font-semibold text-gray-600">No subscriptions found</div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200/50">
            {subscriptions.map((subscription) => (
              <div
                key={subscription.id}
                className="p-5 sm:p-6 hover:bg-gray-50/50 transition-all duration-200"
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
                      <p><strong>Delivery Day:</strong> {subscription.dayOfWeek}</p>
                    </div>
                    
                    {/* Delivery Address */}
                    {(subscription.address || subscription.city || subscription.zipCode) && (
                      <div className="mt-3 p-3 sm:p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200/50">
                        <h4 className="text-sm sm:text-base font-semibold text-gray-700 mb-1">Delivery Address:</h4>
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