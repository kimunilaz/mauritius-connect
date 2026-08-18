import { env } from './env.js';

export const corsOptions = {
  origin(requestOrigin, callback) {
    const isAllowed =
      requestOrigin === undefined || requestOrigin === env.frontendUrl;

    callback(null, isAllowed);
  },
};
