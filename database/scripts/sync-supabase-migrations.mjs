import assert from 'node:assert/strict';
import { copyFile, mkdir, readdir, readFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sourceDirectory = fileURLToPath(
  new URL('../migrations/', import.meta.url),
);
const targetDirectory = fileURLToPath(
  new URL('../../supabase/migrations/', import.meta.url),
);

await mkdir(targetDirectory, { recursive: true });

const sourceNames = (await readdir(sourceDirectory))
  .filter((name) => name.endsWith('.sql'))
  .sort();

assert.ok(sourceNames.length > 0, 'No source migrations were found.');

const targetEntries = await readdir(targetDirectory, { withFileTypes: true });

for (const entry of targetEntries) {
  assert.ok(
    entry.isFile() && entry.name.endsWith('.sql'),
    `Unexpected generated migration entry: ${entry.name}`,
  );
  await unlink(`${targetDirectory}${entry.name}`);
}

for (const name of sourceNames) {
  const sourcePath = `${sourceDirectory}${name}`;
  const targetPath = `${targetDirectory}${name}`;
  await copyFile(sourcePath, targetPath);
  assert.equal(
    await readFile(targetPath, 'utf8'),
    await readFile(sourcePath, 'utf8'),
    `Generated migration differs from source: ${name}`,
  );
}

console.log(
  `Prepared ${sourceNames.length} Supabase CLI migrations from database/migrations.`,
);
