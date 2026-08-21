import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ApiError } from '../services/apiClient.js';
import { getCurrentProfile } from '../services/profileService.js';
import { getSupabaseClient } from '../services/supabaseClient.js';

const AuthContext = createContext(null);

function resolveClient(providedClient) {
  if (providedClient) {
    return { client: providedClient, configurationError: null };
  }

  try {
    return { client: getSupabaseClient(), configurationError: null };
  } catch {
    return {
      client: null,
      configurationError:
        'Authentication is not configured for this environment.',
    };
  }
}

export function AuthProvider({ children, client: providedClient }) {
  const [{ client, configurationError }] = useState(() =>
    resolveClient(providedClient),
  );
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const sessionGeneration = useRef(0);

  const clearAuthState = useCallback(() => {
    sessionGeneration.current += 1;
    setSession(null);
    setProfile(null);
    setOnboardingRequired(false);
    setProfileError(null);
    setLoading(false);
  }, []);

  const establishSession = useCallback(
    async (nextSession) => {
      sessionGeneration.current += 1;
      const generation = sessionGeneration.current;
      setSession(nextSession ?? null);

      if (!nextSession?.access_token) {
        clearAuthState();
        return { profile: null, onboardingRequired: false };
      }

      setLoading(true);
      setProfileError(null);

      try {
        const nextProfile = await getCurrentProfile(nextSession.access_token);

        if (sessionGeneration.current === generation) {
          setProfile(nextProfile);
          setOnboardingRequired(false);
        }

        return { profile: nextProfile, onboardingRequired: false };
      } catch (error) {
        if (error instanceof ApiError && error.code === 'ONBOARDING_REQUIRED') {
          if (sessionGeneration.current === generation) {
            setProfile(null);
            setOnboardingRequired(true);
          }

          return { profile: null, onboardingRequired: true };
        }

        const safeError = {
          code: error instanceof ApiError ? error.code : 'PROFILE_UNAVAILABLE',
          message:
            error instanceof ApiError
              ? error.message
              : 'Your application profile could not be loaded.',
        };
        if (sessionGeneration.current === generation) {
          setProfile(null);
          setOnboardingRequired(false);
          setProfileError(safeError);
        }

        return { profile: null, onboardingRequired: false, error: safeError };
      } finally {
        if (sessionGeneration.current === generation) {
          setLoading(false);
        }
      }
    },
    [clearAuthState],
  );

  useEffect(() => {
    if (!client) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    const { data: listener } = client.auth.onAuthStateChange(
      (event, nextSession) => {
        if (event === 'INITIAL_SESSION') {
          return;
        }

        globalThis.queueMicrotask(() => {
          if (active) {
            void establishSession(nextSession);
          }
        });
      },
    );

    const initializationGeneration = sessionGeneration.current;

    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || sessionGeneration.current !== initializationGeneration) {
          return;
        }

        if (error) {
          clearAuthState();
          setProfileError({
            code: 'SESSION_UNAVAILABLE',
            message: 'Your authentication session could not be restored.',
          });
          return;
        }

        return establishSession(data.session);
      })
      .catch(() => {
        if (active && sessionGeneration.current === initializationGeneration) {
          clearAuthState();
          setProfileError({
            code: 'SESSION_UNAVAILABLE',
            message: 'Your authentication session could not be restored.',
          });
        }
      });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [clearAuthState, client, establishSession]);

  const refreshProfile = useCallback(
    () => establishSession(session),
    [establishSession, session],
  );

  const signOut = useCallback(async () => {
    if (!client) {
      clearAuthState();
      return;
    }

    const { error } = await client.auth.signOut();

    if (error) {
      throw error;
    }

    clearAuthState();
  }, [clearAuthState, client]);

  const value = useMemo(
    () => ({
      session,
      authUser: session?.user ?? null,
      profile,
      loading,
      isAuthenticated: Boolean(session?.user),
      onboardingRequired,
      profileError,
      configurationError,
      client,
      establishSession,
      refreshProfile,
      signOut,
    }),
    [
      client,
      configurationError,
      establishSession,
      loading,
      onboardingRequired,
      profile,
      profileError,
      refreshProfile,
      session,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
