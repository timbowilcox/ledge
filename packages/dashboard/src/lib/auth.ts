import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { provisionUser } from "./provision";

declare module "next-auth" {
  interface Session {
    apiKey: string;
    ledgerId: string;
    userId: string;
    needsTemplate: boolean;
  }
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: {
    signIn: "/signin",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      // On initial sign-in, provision the user in the Ledge API
      if (account && profile) {
        const provider = account.provider;
        const providerId = String(account.providerAccountId);
        const email = token.email ?? `${provider}-${providerId}@ledge.internal`;
        const name = token.name ?? "Ledge User";

        try {
          const result = await provisionUser({
            email,
            name,
            authProvider: provider,
            authProviderId: providerId,
          });

          token.apiKey = result.apiKey;
          token.ledgerId = result.ledgerId;
          token.userId = result.userId;
          token.needsTemplate = result.needsTemplate;
        } catch (err) {
          console.error("[auth] Provision failed:", err);
        }
      }
      return token;
    },
    async session({ session, token }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = token as any;
      session.apiKey = (t.apiKey as string) ?? "";
      session.ledgerId = (t.ledgerId as string) ?? "";
      session.userId = (t.userId as string) ?? "";
      session.needsTemplate = (t.needsTemplate as boolean) ?? false;
      return session;
    },
  },
});
