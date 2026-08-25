import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const failures = [];

async function read(relativePath) {
  return readFile(join(root, relativePath), 'utf8');
}

function requireText(text, pattern, message) {
  if (!pattern.test(text)) failures.push(message);
}

const [vercel, render, frontendExample, backendExample] = await Promise.all([
  read('vercel.json'),
  read('render.yaml'),
  read('frontend/.env.example'),
  read('backend/.env.example'),
]);

requireText(
  vercel,
  /"outputDirectory"\s*:\s*"frontend\/dist"/,
  'Vercel output directory must be frontend/dist.',
);
requireText(
  vercel,
  /"source"\s*:\s*"\/\(\.\*\)"[\s\S]*"destination"\s*:\s*"\/index\.html"/,
  'Vercel must preserve client-side SPA routes.',
);
requireText(
  render,
  /runtime:\s*node/,
  'Render must use the supported Node runtime.',
);
requireText(
  render,
  /numInstances:\s*1/,
  'Render must use one backend instance while rate limiting is process-local.',
);
requireText(
  render,
  /healthCheckPath:\s*\/api\/v1\/health/,
  'Render must use the public health endpoint.',
);
requireText(
  render,
  /autoDeployTrigger:\s*off/,
  'Private-beta backend deploys must remain manually controlled.',
);

const allowedBrowserVariables = new Set([
  'VITE_API_BASE_URL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
]);
const exampleBrowserVariables = [
  ...frontendExample.matchAll(/^([A-Z0-9_]+)=/gm),
].map((match) => match[1]);

for (const name of exampleBrowserVariables) {
  if (!allowedBrowserVariables.has(name)) {
    failures.push(`Unexpected browser environment variable: ${name}.`);
  }
}

for (const name of allowedBrowserVariables) {
  if (!exampleBrowserVariables.includes(name)) {
    failures.push(`Missing browser environment variable example: ${name}.`);
  }
}

for (const name of [
  'FRONTEND_URL',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
]) {
  if (!new RegExp(`^${name}=`, 'm').test(backendExample)) {
    failures.push(`Missing backend environment variable example: ${name}.`);
  }
}

let trackedFiles = [];
try {
  trackedFiles = execFileSync('git', ['ls-files'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .split(/\r?\n/)
    .filter(Boolean);
} catch {
  failures.push('Unable to inspect tracked files for environment files.');
}

const trackedEnvironmentFiles = trackedFiles.filter(
  (file) =>
    /(^|\/)\.env(?:\.|$)/.test(file.replaceAll('\\', '/')) &&
    !file.endsWith('.env.example'),
);
if (trackedEnvironmentFiles.length > 0) {
  failures.push('A non-example environment file is tracked by Git.');
}

async function listFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path)));
    else files.push(path);
  }
  return files;
}

const frontendFiles = await listFiles(join(root, 'frontend', 'src'));
const bundleFiles = await listFiles(join(root, 'frontend', 'dist'));
const inspectedFiles = [...frontendFiles, ...bundleFiles].filter((file) =>
  /\.(?:js|jsx|html|css)$/.test(file),
);
const privilegedBrowserPattern =
  /VITE_[A-Z0-9_]*(?:SECRET|SERVICE_ROLE|DATABASE_URL|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN)|postgres(?:ql)?:\/\//i;

for (const file of inspectedFiles) {
  const content = await readFile(file, 'utf8');
  if (privilegedBrowserPattern.test(content)) {
    failures.push(
      'Privileged configuration material was detected in frontend files.',
    );
    break;
  }
}

if (failures.length > 0) {
  console.error(
    `Deployment configuration verification failed (${failures.length}).`,
  );
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    'Deployment configuration verified: provider topology, environment boundary, SPA routing, and frontend secret checks passed.',
  );
}
