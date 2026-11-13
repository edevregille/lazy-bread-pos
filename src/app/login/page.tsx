import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/config/authOptions";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export const metadata: Metadata = {
  title: "Sign in · Lazy Bread Console",
};

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "This Google account isn't allowed to access the console.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (session) redirect("/");

  const { error } = await searchParams;
  const errorMessage = error
    ? ERROR_MESSAGES[error] ?? "Sign-in failed. Please try again."
    : null;

  return (
    <main className="font-sans min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-200/60 p-8 text-center">
        <div className="mx-auto mb-5 w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
          <span className="text-white text-3xl" aria-hidden="true">🍞</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Lazy Bread Console</h1>
        <p className="mt-2 mb-8 text-sm text-gray-600">Sign in to continue</p>

        {errorMessage && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {errorMessage}
          </div>
        )}

        <GoogleSignInButton />
      </div>
    </main>
  );
}
