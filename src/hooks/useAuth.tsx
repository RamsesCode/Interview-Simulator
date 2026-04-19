import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createAuth0Client, type Auth0Client } from "@auth0/auth0-spa-js";
import {
  getCurrentUser,
  signInLocal,
  signOutLocal,
  signUpLocal,
  type LocalUser,
} from "@/lib/localData";

type AuthSession = {
  user: LocalUser;
};

type AuthContextValue = {
  session: AuthSession | null;
  user: LocalUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

let auth0ClientPromise: Promise<Auth0Client> | null = null;

function hasAuth0Config() {
  return Boolean(import.meta.env.VITE_AUTH0_DOMAIN && import.meta.env.VITE_AUTH0_CLIENT_ID);
}

function getAuth0Client() {
  if (!auth0ClientPromise) {
    auth0ClientPromise = createAuth0Client({
      domain: import.meta.env.VITE_AUTH0_DOMAIN,
      clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
      authorizationParams: {
        redirect_uri: `${window.location.origin}/auth`,
      },
      cacheLocation: "localstorage",
    });
  }
  return auth0ClientPromise;
}

function toLocalUserFromAuth0(user: Record<string, unknown>): LocalUser {
  const email = typeof user.email === "string" ? user.email : "google-user@example.com";
  const fullName =
    typeof user.name === "string"
      ? user.name
      : typeof user.nickname === "string"
        ? user.nickname
        : email;

  return {
    id: typeof user.sub === "string" ? user.sub : email,
    email,
    user_metadata: {
      full_name: fullName,
    },
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (!hasAuth0Config()) {
        const user = getCurrentUser();
        setSession(user ? { user } : null);
        setLoading(false);
        return;
      }

      try {
        const client = await getAuth0Client();

        if (
          window.location.pathname === "/auth" &&
          window.location.search.includes("code=") &&
          window.location.search.includes("state=")
        ) {
          await client.handleRedirectCallback();
          window.history.replaceState({}, document.title, "/auth");
        }

        const isAuthenticated = await client.isAuthenticated();
        if (isAuthenticated) {
          const auth0User = await client.getUser();
          if (auth0User) {
            setSession({ user: toLocalUserFromAuth0(auth0User as Record<string, unknown>) });
            setLoading(false);
            return;
          }
        }
      } catch {
        // Fall back to local auth mode.
      }

      const user = getCurrentUser();
      setSession(user ? { user } : null);
      setLoading(false);
    };

    init();
  }, []);

  const signInWithGoogle = async () => {
    if (!hasAuth0Config()) {
      throw new Error("Auth0 is not configured. Set VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID.");
    }

    const client = await getAuth0Client();
    await client.loginWithRedirect({
      authorizationParams: {
        connection: "google-oauth2",
        redirect_uri: `${window.location.origin}/auth`,
      },
    });
  };

  const signInWithEmail = async (email: string, password: string) => {
    const user = signInLocal(email, password);
    setSession({ user });
  };

  const signUpWithEmail = async (name: string, email: string, password: string) => {
    const user = signUpLocal(name, email, password);
    setSession({ user });
  };

  const signOut = async () => {
    signOutLocal();

    if (hasAuth0Config()) {
      try {
        const client = await getAuth0Client();
        const isAuthenticated = await client.isAuthenticated();
        if (isAuthenticated) {
          client.logout({
            logoutParams: {
              returnTo: `${window.location.origin}/`,
            },
          });
          return;
        }
      } catch {
        // Ignore OAuth signout failures and continue with local signout state.
      }
    }

    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
