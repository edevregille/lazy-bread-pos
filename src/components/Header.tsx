"use client";

import MenuDropdown from "./MenuDropdown";

type TabType = 'pos' | 'orders' | 'subscriptions' | 'customers' | 'settings';

interface HeaderProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export default function Header({ activeTab, onTabChange }: HeaderProps) {
  return (
    <header className="flex items-center justify-between p-4 sm:p-6 mb-4 sm:mb-6">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
          <span className="text-white text-xl sm:text-2xl font-bold">🍞</span>
        </div>
        <h1 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
          Lazy Bread Console
        </h1>
      </div>

      <MenuDropdown activeTab={activeTab} onTabChange={onTabChange} />
    </header>
  );
}

