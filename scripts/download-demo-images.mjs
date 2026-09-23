import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
const base = new URL('../database/seeds/marketplace/', import.meta.url);
const { sources } = JSON.parse(
  await readFile(new URL('images.json', base), 'utf8'),
);
await mkdir(new URL('images/', base), { recursive: true });
for (const source of sources) {
  const target = new URL(`images/${source.filename}`, base);
  try {
    await readFile(target);
    continue;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const response = await fetch(source.download_url, {
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(`Image ${source.id}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(bytes).metadata();
  if (metadata.width < 500) throw new Error(`Image ${source.id} is too small`);
  await writeFile(target, bytes);
  console.log(`Retrieved ${source.filename}`);
}
