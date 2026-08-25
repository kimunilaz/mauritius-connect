import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const forbidden = [
  /SUPABASE_SECRET_KEY\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/i,
  /service_role\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/i,
];
const skip = new Set([
  'node_modules',
  '.git',
  'dist',
  'backend/.env',
  'backend/.env.integration',
]);
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  let files = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (skip.has(e.name) || p.includes(`${join('backend', '.env')}`)) continue;
    if (e.isDirectory()) files.push(...(await walk(p)));
    else if (/\.(js|jsx|mjs|json|md|sql|css)$/.test(e.name)) files.push(p);
  }
  return files;
}
const findings = [];
for (const file of await walk(root)) {
  const text = await readFile(file, 'utf8');
  for (const pattern of forbidden)
    if (pattern.test(text) && !file.endsWith('security-check.mjs'))
      findings.push(file.replace(root, ''));
}
if (findings.length) {
  console.error(
    `Potential hard-coded secret material found in ${findings.length} file(s).`,
  );
  process.exitCode = 1;
} else
  console.log(
    'Security static check passed: no hard-coded credential patterns detected.',
  );
