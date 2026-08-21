export const MIN_PASSWORD_LENGTH = 8;

export function validatePassword(password, confirmation) {
  const fields = {};

  if (!password) {
    fields.password = 'Enter a password.';
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    fields.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (password !== confirmation) {
    fields.passwordConfirmation = 'Passwords do not match.';
  }

  return fields;
}

export function authRedirectUrl(nextPath) {
  const url = new globalThis.URL('/auth/callback', globalThis.location.origin);

  if (nextPath) {
    url.searchParams.set('next', nextPath);
  }

  return url.toString();
}
