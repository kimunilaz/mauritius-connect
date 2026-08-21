import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const frontendSource = fileURLToPath(
  new globalThis.URL('../../../frontend/src/', import.meta.url),
);
const requestLoggerPath = fileURLToPath(
  new globalThis.URL('../../src/middleware/requestLogger.js', import.meta.url),
);

async function readSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const path = `${directory}/${entry.name}`;
      return entry.isDirectory()
        ? readSourceFiles(path)
        : entry.name.match(/\.(js|jsx)$/)
          ? readFile(path, 'utf8')
          : [];
    }),
  );

  return contents.flat(Infinity);
}

describe('credential boundaries', () => {
  it('does not consume privileged environment variables in frontend runtime code', async () => {
    const source = (await readSourceFiles(frontendSource)).join('\n');

    expect(source).not.toMatch(/SUPABASE_SECRET_KEY/);
    expect(source).not.toMatch(/DATABASE_URL/);
  });

  it('does not log Authorization header contents', async () => {
    const source = await readFile(requestLoggerPath, 'utf8');

    expect(source.toLowerCase()).not.toContain('authorization');
    expect(source.toLowerCase()).not.toContain('access_token');
  });
});
