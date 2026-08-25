import { describe, expect, it } from 'vitest';
import { parseEnvironment } from '../../src/config/env.js';

const productionEnvironment = {
  NODE_ENV: 'production',
  PORT: '3000',
  FRONTEND_URL: 'https://beta.example.com',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-test-value',
  SUPABASE_SECRET_KEY: 'test-secret',
};

describe('production environment configuration', () => {
  it('accepts the complete HTTPS deployment configuration', () => {
    const result = parseEnvironment(productionEnvironment);

    expect(result.nodeEnv).toBe('production');
    expect(result.frontendUrl).toBe('https://beta.example.com');
  });

  it.each([
    'FRONTEND_URL',
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SECRET_KEY',
  ])('fails closed when %s is missing', (name) => {
    const source = { ...productionEnvironment };
    delete source[name];

    expect(() => parseEnvironment(source)).toThrow(name);
  });

  it('rejects a non-HTTPS production frontend origin', () => {
    expect(() =>
      parseEnvironment({
        ...productionEnvironment,
        FRONTEND_URL: 'http://beta.example.com',
      }),
    ).toThrow('FRONTEND_URL must use HTTPS');
  });

  it('rejects a production frontend URL containing a path', () => {
    expect(() =>
      parseEnvironment({
        ...productionEnvironment,
        FRONTEND_URL: 'https://beta.example.com/app',
      }),
    ).toThrow('one exact origin');
  });

  it('rejects a non-HTTPS production Supabase URL', () => {
    expect(() =>
      parseEnvironment({
        ...productionEnvironment,
        SUPABASE_URL: 'http://project.supabase.co',
      }),
    ).toThrow('SUPABASE_URL must use HTTPS');
  });

  it('keeps credential-free local development defaults available', () => {
    const result = parseEnvironment({ NODE_ENV: 'development' });

    expect(result.frontendUrl).toBe('http://localhost:5173');
    expect(result.supabaseSecretKey).toBeUndefined();
  });
});
