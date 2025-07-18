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
    <header className="flex items-center justify-between p-3 sm:p-6">
      <div className="flex items-center space-x-2">
        <h1 className="text-lg sm:text-2xl font-semibold text-black">Lazy Bread PoS</h1>
      </div>

      <button
        onClick={handleGoogleLogin}
        className="px-3 py-2 sm:px-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-md text-sm sm:text-base"
      >
        {session ? "Sign-out" : "Sign-in"}
      </button>
    </header>
  );
}
