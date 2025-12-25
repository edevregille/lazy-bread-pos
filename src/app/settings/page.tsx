"use client";

import { useState, useEffect } from 'react';

interface AppConfig {
  NAV_ITEMS?: Array<{ name: string; path: string }>;
  AUTH_NAV_ITEMS?: Array<{ name: string; path: string }>;
  BREAD_TYPES?: Array<{
    id: string;
    name: string;
    price: number;
    description: string;
    availableForOrders: boolean;
  }>;
  BUSINESS_SETTINGS?: {
    isHolidayMode: boolean;
    holidayMessage: string;
    returnDate: string;
    email: string;
    phone: string;
    instagram: string;
    recurringOrdersEmail: string;
    deliveryDays: string[];
    minOrderAdvanceHours: number;
    maxOrderQuantity: number;
    excludedDeliveryDates: string[];
  };
  DELIVERY_ZONES?: {
    cityName: string;
    stateName: string;
    allowedZipCodes: string[];
  };
  FIND_US_LOCATIONS?: Array<{
    id: string;
    name: string;
    address: string;
    image: string;
    imageAlt: string;
    schedule: string;
    active: boolean;
    coordinates: { lat: number; lng: number };
  }>;
  SOCIAL_MEDIA?: {
    instagram: { url: string; handle: string; active: boolean };
    email: { address: string; active: boolean };
  };
  VALIDATION_RULES?: {
    requireCaptcha: boolean;
    requirePhoneValidation: boolean;
    maxCommentLength: number;
  };
  PAGE_CONTENT?: {
    orderPageTitle: string;
    holidayPageTitle: string;
    recurringDeliveryMessage: string;
    deliveryInstructions: string;
    commentsPlaceholder: string;
    commentsHelper: string;
  };
  ERROR_MESSAGES?: Record<string, string>;
}

export default function SettingsPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [configApiUrl, setConfigApiUrl] = useState<string>('');

  useEffect(() => {
    // Get config API URL from environment
    const apiUrl = process.env.NEXT_PUBLIC_CONFIG_API_URL || '';
    setConfigApiUrl(apiUrl);
    
    if (apiUrl) {
      fetchConfig(apiUrl);
    } else {
      setError('Config API URL not configured');
      setLoading(false);
    }
  }, []);

  const fetchConfig = async (apiUrl: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.success && data.config) {
        setConfig(data.config);
      } else {
        throw new Error('Invalid config response');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config || !configApiUrl) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(configApiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to save: ${response.statusText}`);
      }

      setSuccess('Configuration saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (path: string[], value: any) => {
    if (!config) return;
    
    const newConfig = { ...config };
    let current: any = newConfig;
    
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }
    
    current[path[path.length - 1]] = value;
    setConfig(newConfig);
  };

  if (loading) {
    return (
      <div className="w-full">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-gray-900">Loading configuration...</div>
        </div>
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="w-full">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="container mx-auto px-4 py-8">
        {/* Save Button - Fixed at top right */}
        <div className="flex justify-end mb-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Error and Success Messages */}
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}

        {config && (
          <div className="space-y-6">
            {/* Business Settings Tile */}
            <section className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">Business Settings</h2>
                {config.BUSINESS_SETTINGS && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        Holiday Mode
                      </label>
                      <input
                        type="checkbox"
                        checked={config.BUSINESS_SETTINGS.isHolidayMode}
                        onChange={(e) => updateConfig(['BUSINESS_SETTINGS', 'isHolidayMode'], e.target.checked)}
                        className="w-4 h-4"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        Holiday Message
                      </label>
                      <input
                        type="text"
                        value={config.BUSINESS_SETTINGS.holidayMessage}
                        onChange={(e) => updateConfig(['BUSINESS_SETTINGS', 'holidayMessage'], e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={config.BUSINESS_SETTINGS.email}
                        onChange={(e) => updateConfig(['BUSINESS_SETTINGS', 'email'], e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        Phone
                      </label>
                      <input
                        type="text"
                        value={config.BUSINESS_SETTINGS.phone}
                        onChange={(e) => updateConfig(['BUSINESS_SETTINGS', 'phone'], e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        Min Order Advance Hours
                      </label>
                      <input
                        type="number"
                        value={config.BUSINESS_SETTINGS.minOrderAdvanceHours}
                        onChange={(e) => updateConfig(['BUSINESS_SETTINGS', 'minOrderAdvanceHours'], parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        Max Order Quantity
                      </label>
                      <input
                        type="number"
                        value={config.BUSINESS_SETTINGS.maxOrderQuantity}
                        onChange={(e) => updateConfig(['BUSINESS_SETTINGS', 'maxOrderQuantity'], parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        Delivery Days (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={config.BUSINESS_SETTINGS.deliveryDays.join(', ')}
                        onChange={(e) => updateConfig(['BUSINESS_SETTINGS', 'deliveryDays'], e.target.value.split(',').map(s => s.trim()))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        Excluded Delivery Dates (one per line, YYYY-MM-DD)
                      </label>
                      <textarea
                        value={config.BUSINESS_SETTINGS.excludedDeliveryDates.join('\n')}
                        onChange={(e) => {
                          // Preserve all lines including empty ones for editing
                          // Only filter empty lines when processing, not during editing
                          const lines = e.target.value.split('\n');
                          updateConfig(['BUSINESS_SETTINGS', 'excludedDeliveryDates'], lines);
                        }}
                        onBlur={(e) => {
                          // Filter out empty lines only when user leaves the field
                          const lines = e.target.value.split('\n').filter(s => s.trim());
                          updateConfig(['BUSINESS_SETTINGS', 'excludedDeliveryDates'], lines);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
                        rows={5}
                      />
                    </div>
                  </div>
                )}
            </section>

            {/* Bread Types Tile */}
            <section className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-semibold text-gray-900">Bread Types</h2>
                  <button
                    onClick={() => {
                      const newBread = {
                        id: `bread-${Date.now()}`,
                        name: '',
                        price: 0,
                        description: '',
                        availableForOrders: true
                      };
                      setConfig({
                        ...config,
                        BREAD_TYPES: [...(config.BREAD_TYPES || []), newBread]
                      });
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                  >
                    + Add Bread Type
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {config.BREAD_TYPES && config.BREAD_TYPES.map((bread, index) => (
                    <div key={bread.id} className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-base font-semibold text-gray-900">Bread Type #{index + 1}</h3>
                        <button
                          onClick={() => {
                            const newBreads = config.BREAD_TYPES?.filter((_, i) => i !== index) || [];
                            setConfig({ ...config, BREAD_TYPES: newBreads });
                          }}
                          className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-medium"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="space-y-2">
                      <input
                        type="text"
                        value={bread.name}
                        onChange={(e) => {
                          const newBreads = [...(config.BREAD_TYPES || [])];
                          newBreads[index].name = e.target.value;
                          setConfig({ ...config, BREAD_TYPES: newBreads });
                        }}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md text-gray-900 bg-white"
                        placeholder="Bread Name"
                      />
                      <div>
                        <label className="block text-xs font-medium text-gray-900 mb-1">Price</label>
                        <input
                          type="number"
                          step="0.01"
                          value={bread.price}
                          onChange={(e) => {
                            const newBreads = [...(config.BREAD_TYPES || [])];
                            newBreads[index].price = parseFloat(e.target.value) || 0;
                            setConfig({ ...config, BREAD_TYPES: newBreads });
                          }}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md text-gray-900 bg-white"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-900 mb-1">Description</label>
                        <textarea
                          value={bread.description}
                          onChange={(e) => {
                            const newBreads = [...(config.BREAD_TYPES || [])];
                            newBreads[index].description = e.target.value;
                            setConfig({ ...config, BREAD_TYPES: newBreads });
                          }}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md text-gray-900 bg-white"
                          placeholder="Description"
                          rows={2}
                        />
                      </div>
                      <label className="flex items-center text-gray-900">
                        <input
                          type="checkbox"
                          checked={bread.availableForOrders}
                          onChange={(e) => {
                            const newBreads = [...(config.BREAD_TYPES || [])];
                            newBreads[index].availableForOrders = e.target.checked;
                            setConfig({ ...config, BREAD_TYPES: newBreads });
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm font-medium">Available for Orders</span>
                      </label>
                    </div>
                    </div>
                  ))}
                </div>
            </section>

            {/* JSON Editor Tile */}
            <section className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">Advanced: JSON Editor</h2>
                <textarea
                  value={JSON.stringify(config, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setConfig(parsed);
                      setError(null);
                    } catch (err) {
                      setError('Invalid JSON');
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm text-gray-900 bg-white"
                  rows={20}
                />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

