'use client'

import { useSession, signIn, signOut } from 'next-auth/react';

export default function Header(){
    const { data: session } = useSession();

    const handleGoogleLogin = () => {
        if(session) signOut();
        else  signIn('google');
    }

    return (
        <header className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-semibold text-black">Lazy Bread Point Of Sale</h1>
            </div>
  
            <button
                onClick={handleGoogleLogin}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-md"
            >
                {session ? 'Sign-out':'Sign-in'}
            </button>
      </header>
    )
}