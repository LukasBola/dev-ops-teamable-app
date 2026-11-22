import { createAuthClient } from 'better-auth/vue'

// Bez baseURL: ten sam origin co aplikacja (proxy Vite / nginx), patrz ADR-0002.
export const { useSession, signIn, signOut } = createAuthClient()
