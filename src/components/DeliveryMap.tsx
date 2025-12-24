"use client";

import { useEffect, useRef, useState, useMemo } from 'react';

interface Order {
  id: string;
  customerName?: string;
  address?: string;
  city?: string;
  zipCode?: string;
}

interface DeliveryMapProps {
  orders: Order[];
  deliveryDate: string;
}

// Google Maps types
interface GoogleMaps {
  maps: {
    Map: new (element: HTMLElement, options: object) => GoogleMap;
    Geocoder: new () => GoogleGeocoder;
    Marker: new (options: object) => GoogleMarker;
    InfoWindow: new (options: object) => GoogleInfoWindow;
    LatLngBounds: new () => GoogleLatLngBounds;
    event: {
      addListenerOnce: (map: GoogleMap, event: string, callback: () => void) => void;
    };
    SymbolPath: {
      CIRCLE: symbol;
    };
  };
}

interface GoogleMap {
  setZoom: (zoom: number) => void;
  getZoom: () => number;
  fitBounds: (bounds: GoogleLatLngBounds) => void;
}

interface GoogleGeocoder {
  geocode: (request: { address: string }, callback: (results: GoogleGeocoderResult[], status: string) => void) => void;
}

interface GoogleGeocoderResult {
  geometry: {
    location: GoogleLatLng;
  };
}

interface GoogleLatLng {
  lat: () => number;
  lng: () => number;
}

interface GoogleMarker {
  setMap: (map: GoogleMap | null) => void;
  getPosition: () => GoogleLatLng;
  addListener: (event: string, callback: () => void) => void;
}

interface GoogleInfoWindow {
  open: (map: GoogleMap, marker: GoogleMarker) => void;
}

interface GoogleLatLngBounds {
  extend: (latLng: GoogleLatLng) => void;
}

declare global {
  interface Window {
    google: GoogleMaps;
  }
}

// Function to load Google Maps script
const loadGoogleMapsScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if script is already loaded
    if (window.google && window.google.maps) {
      resolve();
      return;
    }

    // Check if script is already in the process of loading
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      // Wait for it to load
      const checkLoaded = () => {
        if (window.google && window.google.maps) {
          resolve();
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      checkLoaded();
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      reject(new Error('Google Maps API key not found'));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      resolve();
    };
    
    script.onerror = () => {
      console.error('Failed to load Google Maps script');
      reject(new Error('Failed to load Google Maps script'));
    };

    document.head.appendChild(script);
  });
};

export default function DeliveryMap({ orders, deliveryDate }: DeliveryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<GoogleMap | null>(null);
  const [markers, setMarkers] = useState<GoogleMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  // Filter orders that have address information - memoized to prevent infinite loops
  const ordersWithAddress = useMemo(() => 
    orders.filter(order => order.address),
    [orders]
  );

  // Load Google Maps script
  useEffect(() => {    
    loadGoogleMapsScript()
      .then(() => {
        setMapsLoaded(true);
        setLoading(false);
      })
      .catch((error) => {
        console.error('DeliveryMap: Failed to load Google Maps:', error);
        setError('Failed to load Google Maps');
        setLoading(false);
      });
  }, []);

  // Initialize map after Google Maps is loaded
  useEffect(() => {
    
    // Only initialize if Google Maps is loaded and we have orders with addresses
    if (!mapsLoaded || ordersWithAddress.length === 0) {
      return;
    }
    
    // Don't re-initialize if map already exists
    if (map) {
      console.log('DeliveryMap: Map already exists, skipping initialization');
      return;
    }
    
    const initializeMap = () => {
    
      
      if (!mapRef.current) {
        console.error('DeliveryMap: mapRef.current is null');
        setError('Map container not available');
        return;
      }
      
      if (!window.google || !window.google.maps) {
        console.error('DeliveryMap: Google Maps not available');
        setError('Google Maps not available');
        return;
      }

      try {
        // Create map centered on Portland, OR
        const portland = { lat: 45.5152, lng: -122.6784 };
        const newMap = new window.google.maps.Map(mapRef.current, {
          center: portland,
          zoom: 10,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            }
          ]
        });

        setMap(newMap);
      } catch (error) {
        console.error('DeliveryMap: Map initialization error:', error);
        setError('Failed to initialize map');
      }
    };

    // Wait for the DOM element to be ready
    const timer = setTimeout(() => {
      if (mapRef.current) {
        initializeMap();
      } else {
        console.error('DeliveryMap: mapRef.current still null after timeout');
        setError('Map container not available');
      }
    }, 100);

    // Cleanup function
    return () => {
      clearTimeout(timer);
    };
  }, [mapsLoaded, ordersWithAddress.length]);

  // Cleanup markers on unmount
  useEffect(() => {
    return () => {
      if (map) {
        markers.forEach(marker => marker.setMap(null));
      }
    };
  }, [map, markers]);

  useEffect(() => {
    if (!map || !window.google) return;

    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));
    const newMarkers: GoogleMarker[] = [];

    // Geocode addresses and add markers
    const geocoder = new window.google.maps.Geocoder();
    let geocodedCount = 0;

    ordersWithAddress.forEach((order, index) => {
      const address = `${order.address}, ${order.city}, ${order.zipCode}`;
      
      geocoder.geocode({ address }, (results: GoogleGeocoderResult[], status: string) => {
        if (status === 'OK' && results[0]) {
          const location = results[0].geometry.location;
          
          // Create marker
          const marker = new window.google.maps.Marker({
            position: location,
            map: map,
            title: `${order.customerName || 'Customer'} - ${address}`,
            label: {
              text: (index + 1).toString(),
              color: 'white',
              fontWeight: 'bold'
            },
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#3B82F6',
              fillOpacity: 1,
              strokeColor: '#1E40AF',
              strokeWeight: 2
            }
          });

          // Create info window
          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div style="padding: 12px; max-width: 250px; min-width: 200px;">
                <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: bold; color: #1f2937;">
                  ${order.customerName || 'Customer'}
                </h3>
                <p style="margin: 0 0 4px 0; font-size: 13px; color: #4b5563; line-height: 1.4;">
                  ${address}
                </p>
                <p style="margin: 0; font-size: 12px; color: #6b7280; font-weight: 500;">
                  Order #${order.id}
                </p>
              </div>
            `
          });

          // Add click listener to marker
          marker.addListener('click', () => {
            infoWindow.open(map, marker);
          });

          newMarkers.push(marker);
        }

        geocodedCount++;
        
        // If all addresses have been processed, fit bounds
        if (geocodedCount === ordersWithAddress.length && newMarkers.length > 0) {
          const bounds = new window.google.maps.LatLngBounds();
          newMarkers.forEach(marker => {
            bounds.extend(marker.getPosition());
          });
          map.fitBounds(bounds);
          
          // Add some padding to the bounds
          window.google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
            map.setZoom(Math.min(map.getZoom(), 12));
          });
        }
      });
    });

    setMarkers(newMarkers);
  }, [map, ordersWithAddress.length]);

  if (loading) {
    return (
      <div className="bg-white p-4 lg:p-6 rounded-lg shadow-md">
        <h3 className="text-lg lg:text-xl font-semibold text-black mb-4">Delivery Map</h3>
        <div className="flex justify-center items-center h-48 sm:h-64 bg-gray-100 rounded-lg">
          <div className="text-gray-600">Loading map...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-4 lg:p-6 rounded-lg shadow-md">
        <h3 className="text-lg lg:text-xl font-semibold text-black mb-4">Delivery Map</h3>
        <div className="flex justify-center items-center h-48 sm:h-64 bg-gray-100 rounded-lg">
          <div className="text-red-600 text-center">
            <div className="mb-2">⚠️</div>
            <div className="text-sm lg:text-base">{error}</div>
            <div className="text-xs lg:text-sm text-gray-500 mt-2">
              Please check your Google Maps API key configuration
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (ordersWithAddress.length === 0) {
    return (
      <div className="bg-white p-4 lg:p-6 rounded-lg shadow-md">
        <h3 className="text-lg lg:text-xl font-semibold text-black mb-4">Delivery Map</h3>
        <div className="flex justify-center items-center h-48 sm:h-64 bg-gray-100 rounded-lg">
          <div className="text-gray-600 text-center">
            <div className="mb-2">📍</div>
            <div className="text-sm lg:text-base">No delivery addresses available</div>
            <div className="text-xs lg:text-sm text-gray-500 mt-2">
              Orders for this date don&apos;t have complete address information
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 lg:p-6 rounded-lg shadow-md">
      <h3 className="text-lg lg:text-xl font-semibold text-black mb-4">
        Delivery Map ({ordersWithAddress.length} locations)
      </h3>
      <div 
        ref={mapRef} 
        className="w-full h-64 sm:h-80 lg:h-96 rounded-lg border border-gray-200"
        style={{ minHeight: '250px' }}
      />
      <div className="mt-3 lg:mt-4 text-xs lg:text-sm text-gray-600 space-y-1">
        <p>• Tap on markers to see customer details</p>
        <p>• Map shows all delivery locations for {new Date(deliveryDate).toLocaleDateString()}</p>
      </div>
    </div>
  );
} 