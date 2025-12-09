"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

type TabType = 'pos' | 'orders' | 'subscriptions' | 'customers';

interface MenuDropdownProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

interface MenuItem {
  id: TabType;
  label: string;
  icon: string;
}

const menuItems: MenuItem[] = [
  { id: 'pos', label: 'Point of Sale', icon: '💳' },
  { id: 'orders', label: 'Deliveries', icon: '🚚' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '📅' },
  { id: 'customers', label: 'Customers', icon: '👥' },
];

export default function MenuDropdown({ activeTab, onTabChange }: MenuDropdownProps) {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleGoogleLogin = () => {
    if (session) {
      signOut();
    } else {
      signIn("google");
    }
    setIsOpen(false);
  };

  const handleTabClick = (tab: TabType) => {
    onTabChange(tab);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
        aria-label="Menu"
      >
        <svg
          className={`w-6 h-6 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 sm:w-72 bg-white rounded-xl shadow-2xl border border-gray-200/50 overflow-hidden z-50 transform transition-all duration-200 ease-out">
          <div className="py-2">
            {/* Navigation Items */}
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 text-left transition-all duration-200 hover:bg-gray-50 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-50/50 to-white border-l-4 border-blue-600'
                      : ''
                  }`}
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span
                    className={`font-semibold text-sm sm:text-base flex-1 ${
                      isActive ? 'text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    {item.label}
                  </span>
                  {isActive && (
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  )}
                </button>
              );
            })}

            {/* Divider */}
            <div className="my-2 border-t border-gray-200"></div>

            {/* Sign In/Out Button */}
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center space-x-3 px-4 py-3 text-left transition-all duration-200 hover:bg-gray-50"
            >
              <span className="text-2xl">
                {session ? '🚪' : '🔑'}
              </span>
              <span className="font-semibold text-sm sm:text-base text-gray-700 flex-1">
                {session ? 'Sign Out' : 'Sign In'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

