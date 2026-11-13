import GoogleProvider from "next-auth/providers/google";
import { AuthOptions } from "next-auth";

const ALLOWED_EMAILS = [
  "manudevregille@gmail.com",
  "lilliandevregille@gmail.com",
  "manu@metronome.com",
];
export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
    error: "/login", // e.g. ?error=AccessDenied for accounts not in ALLOWED_EMAILS
  },
  callbacks: {
    async signIn({ user }) {
      if (user.email && ALLOWED_EMAILS.includes(user.email)) {
        return true;
      } else {
        return false;
      }
    },
  },
};
