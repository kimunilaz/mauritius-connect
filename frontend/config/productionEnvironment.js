const requiredBrowserVariables = [
  'VITE_API_BASE_URL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
];

const privilegedNamePattern =
  /^VITE_.*(?:SECRET|SERVICE_ROLE|DATABASE_URL|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN)/i;

function requireHttpsUrl(name, value) {
  let url;

  try {
    url = new globalThis.URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }

  if (url.protocol !== 'https:') {
    throw new Error(`${name} must use HTTPS for a private-beta build.`);
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      `${name} must not contain credentials, a query, or a fragment.`,
    );
  }

  return url;
}

export function requiresProductionEnvironment({ mode, environment }) {
  return (
    mode === 'production' &&
    (environment.VERCEL === '1' ||
      Boolean(environment.VERCEL_ENV) ||
      environment.PRIVATE_BETA_DEPLOYMENT === 'true')
  );
}

export function validateProductionEnvironment({ mode, environment }) {
  const privilegedNames = Object.keys(environment).filter((name) =>
    privilegedNamePattern.test(name),
  );

  if (privilegedNames.length > 0) {
    throw new Error(
      `Privileged values must not use VITE_ variables: ${privilegedNames.join(', ')}.`,
    );
  }

  if (!requiresProductionEnvironment({ mode, environment })) {
    return;
  }

  const missing = requiredBrowserVariables.filter(
    (name) => !environment[name]?.trim(),
  );

  if (missing.length > 0) {
    throw new Error(
      `Private-beta browser configuration is missing: ${missing.join(', ')}.`,
    );
  }

  const apiUrl = requireHttpsUrl(
    'VITE_API_BASE_URL',
    environment.VITE_API_BASE_URL,
  );
  const supabaseUrl = requireHttpsUrl(
    'VITE_SUPABASE_URL',
    environment.VITE_SUPABASE_URL,
  );

  if (apiUrl.pathname.replace(/\/$/, '') !== '/api/v1') {
    throw new Error('VITE_API_BASE_URL must end at the /api/v1 base path.');
  }

  if (supabaseUrl.pathname !== '/') {
    throw new Error(
      'VITE_SUPABASE_URL must be a project origin without a path.',
    );
  }
}
