"use client";

import { useSession, signIn, signOut } from "next-auth/react";

export default function Header() {
  const { data: session } = useSession();

  const handleGoogleLogin = () => {
    console.log("signin", session)
    if (session) signOut();
    else signIn("google");
  };

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

      <button
        onClick={handleGoogleLogin}
        className="px-4 py-2.5 sm:px-6 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl text-sm sm:text-base shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
      >
        {session ? "Sign Out" : "Sign In"}
      </button>
    </header>
  );
}
