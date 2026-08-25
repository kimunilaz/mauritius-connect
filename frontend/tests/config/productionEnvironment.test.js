import { describe, expect, it } from 'vitest';
import { validateProductionEnvironment } from '../../config/productionEnvironment.js';

const productionEnvironment = {
  VERCEL: '1',
  VITE_API_BASE_URL: 'https://api.example.com/api/v1',
  VITE_SUPABASE_URL: 'https://project.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-test-value',
};

describe('private-beta frontend build environment', () => {
  it('accepts only the required browser-safe HTTPS configuration', () => {
    expect(() =>
      validateProductionEnvironment({
        mode: 'production',
        environment: productionEnvironment,
      }),
    ).not.toThrow();
  });

  it.each([
    'VITE_API_BASE_URL',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
  ])('fails a hosted build when %s is missing', (name) => {
    const environment = { ...productionEnvironment };
    delete environment[name];

    expect(() =>
      validateProductionEnvironment({ mode: 'production', environment }),
    ).toThrow(name);
  });

  it('rejects a localhost API URL in a private-beta build', () => {
    expect(() =>
      validateProductionEnvironment({
        mode: 'production',
        environment: {
          ...productionEnvironment,
          VITE_API_BASE_URL: 'http://localhost:3000/api/v1',
        },
      }),
    ).toThrow('must use HTTPS');
  });

  it('rejects an API URL without the versioned base path', () => {
    expect(() =>
      validateProductionEnvironment({
        mode: 'production',
        environment: {
          ...productionEnvironment,
          VITE_API_BASE_URL: 'https://api.example.com',
        },
      }),
    ).toThrow('/api/v1');
  });

  it('rejects privileged values placed in Vite variables', () => {
    expect(() =>
      validateProductionEnvironment({
        mode: 'production',
        environment: {
          ...productionEnvironment,
          VITE_SUPABASE_SECRET_KEY: 'test-secret',
        },
      }),
    ).toThrow('Privileged values must not use VITE_');
  });

  it('keeps ordinary local production builds available for release checks', () => {
    expect(() =>
      validateProductionEnvironment({
        mode: 'production',
        environment: {},
      }),
    ).not.toThrow();
  });
});
