// Auth stub — replace with full NextAuth when OAuth credentials are configured.
// The dashboard works as a demo without authentication.
// To enable real auth: set AUTH_SECRET, AUTH_GITHUB_ID/SECRET, AUTH_GOOGLE_ID/SECRET
// in .env.local and swap this file for the NextAuth integration.

export async function auth() {
  return {
    user: {
      name: "Demo User",
      email: "demo@ledge.dev",
    },
  };
}

export function signIn(_provider: string) {
  if (typeof window !== "undefined") {
    window.location.href = "/templates";
  }
}

export function signOut() {
  if (typeof window !== "undefined") {
    window.location.href = "/signin";
  }
}

export const handlers = {
  GET: async () => new Response("Auth not configured — see .env.example", { status: 501 }),
  POST: async () => new Response("Auth not configured — see .env.example", { status: 501 }),
};
