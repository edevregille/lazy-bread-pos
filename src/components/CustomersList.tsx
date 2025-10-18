"use client";

import { useState, useEffect } from 'react';

interface User {
  uid: string;
  displayName: string;
  email: string;
  phone?: string;
  stripeCustomerId: string;
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryState?: string;
  deliveryZipCode?: string;
  createdAt: string;
  updatedAt: string;
  totalOrders?: number;
  totalSpent?: number;
  lastOrderDate?: string;
}

interface UsersResponse {
  success: boolean;
  count: number;
  users: User[];
}

export default function CustomersList() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/users');
      const data: UsersResponse = await response.json();
      
      if (data.success) {
        console.log('Users data received:', data.users);
        setUsers(data.users);
      } else {
        setError('Failed to fetch users');
      }
    } catch (err) {
      setError('Error loading users');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.warn(`Error formatting date: ${dateString}`, error);
      return 'Invalid Date';
    }
  };

  const filteredUsers = users.filter(user => 
    (user.displayName && user.displayName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.phone && user.phone.includes(searchTerm)) ||
    (user.stripeCustomerId && user.stripeCustomerId.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center p-4 sm:p-8">
        <div className="text-lg text-gray-600">Loading customers...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center p-4 sm:p-8">
        <div className="text-lg text-red-600 mb-4">{error}</div>
        <button
          onClick={fetchUsers}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex justify-center items-center p-4 sm:p-8">
        <div className="text-lg text-gray-600">No customers found</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="bg-white p-4 lg:p-6 rounded-lg shadow-md">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-black mb-2">
              Customers ({users.length})
            </h2>
            <p className="text-sm lg:text-base text-gray-600">
              Manage your customer database
            </p>
          </div>
          <button
            onClick={fetchUsers}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 text-sm font-medium"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 lg:p-6 rounded-lg shadow-md">
        <div className="relative">
          <input
            type="text"
            placeholder="Search customers by name, email, phone, or Stripe ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {filteredUsers.map((user) => (
          <div
            key={user.uid}
            className="bg-white p-4 lg:p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            {/* Customer Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg lg:text-xl font-semibold text-black mb-1">
                  {user.displayName || 'No name provided'}
                </h3>
                <p className="text-sm text-gray-600 mb-1">
                  {user.email || 'No email provided'}
                </p>
                {user.phone && (
                  <p className="text-sm text-gray-600 mb-1">
                    {user.phone}
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  Stripe ID: {user.stripeCustomerId ? (
                    <a
                      href={`https://dashboard.stripe.com/acct_1Qlh7eG05wamoDo7/customers/${user.stripeCustomerId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      {user.stripeCustomerId}
                    </a>
                  ) : (
                    'N/A'
                  )}
                </p>
              </div>
              <div className="ml-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-lg">
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : '?'}
                  </span>
                </div>
              </div>
            </div>


            {/* Delivery Address */}
            {(user.deliveryAddress || user.deliveryCity || user.deliveryState || user.deliveryZipCode) && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <h5 className="text-xs font-medium text-gray-700 mb-1">Delivery Address:</h5>
                <div className="text-sm text-gray-600">
                  {user.deliveryAddress && <p>{user.deliveryAddress}</p>}
                  {(user.deliveryCity || user.deliveryState || user.deliveryZipCode) && (
                    <p>
                      {user.deliveryCity && user.deliveryCity}
                      {user.deliveryCity && user.deliveryState && ', '}
                      {user.deliveryState && user.deliveryState}
                      {user.deliveryZipCode && ` ${user.deliveryZipCode}`}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Customer Info */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <h5 className="text-xs font-medium text-gray-700 mb-1">Customer Info:</h5>
              <div className="text-sm text-gray-600">
                <p>UID: {user.uid}</p>
                <p>Created: {formatDate(user.createdAt)}</p>
                {user.updatedAt && user.updatedAt !== user.createdAt && (
                  <p>Updated: {formatDate(user.updatedAt)}</p>
                )}
              </div>
            </div>

            {/* Customer Info Footer */}
            <div className="border-t pt-3">
              <div className="flex justify-between items-center text-xs text-gray-500">
                <span>Customer since: {formatDate(user.createdAt)}</span>
                {user.lastOrderDate && (
                  <span>Last order: {formatDate(user.lastOrderDate)}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* No Results Message */}
      {filteredUsers.length === 0 && searchTerm && (
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <div className="text-gray-500 text-lg mb-2">No customers found</div>
          <div className="text-gray-400 text-sm">
            Try adjusting your search terms
          </div>
        </div>
      )}
    </div>
  );
}
