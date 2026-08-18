import app from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.port, () => {
  console.log(`API listening on port ${env.port}.`);
});

server.on('error', (error) => {
  console.error('Unable to start the API server.', error);
  process.exitCode = 1;
});
