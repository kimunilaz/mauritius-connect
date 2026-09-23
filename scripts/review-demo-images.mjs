import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
const base = new URL('../database/seeds/marketplace/', import.meta.url);
const { sources } = JSON.parse(
  await readFile(new URL('images.json', base), 'utf8'),
);
const tiles = [];
for (const [i, source] of sources.entries()) {
  const left = (i % 4) * 300;
  const top = Math.floor(i / 4) * 220;
  tiles.push({
    input: await sharp(
      await readFile(new URL(`images/${source.filename}`, base)),
    )
      .resize(300, 190, { fit: 'inside' })
      .extend({ top: 0, bottom: 0, left: 0, right: 0 })
      .toBuffer(),
    left,
    top,
  });
  tiles.push({
    input: Buffer.from(
      `<svg width="300" height="30"><rect width="300" height="30" fill="white"/><text x="8" y="21" font-size="16">${source.id} · ${source.role}</text></svg>`,
    ),
    left,
    top: top + 190,
  });
}
await sharp({
  create: {
    width: 1200,
    height: Math.ceil(sources.length / 4) * 220,
    channels: 3,
    background: 'white',
  },
})
  .composite(tiles)
  .jpeg()
  .toFile('test-results/demo-image-review.jpg');
