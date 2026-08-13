'use strict';

// Temporary bootstrap: prove the function loads, then hand off to Nest.
module.exports = async function handler(req, res) {
  try {
    require('reflect-metadata');
    const mod = require('../dist/serverless.js');
    const nestHandler = typeof mod === 'function' ? mod : mod && mod.default;
    if (typeof nestHandler !== 'function') {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          data: null,
          error: {
            code: 'NEST_HANDLER_MISSING',
            message: 'Nest handler export is not a function',
            keys: mod && typeof mod === 'object' ? Object.keys(mod) : typeof mod,
          },
        }),
      );
      return;
    }
    return nestHandler(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    console.error('[INTEGRA] api/index.js error:', message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        data: null,
        error: {
          code: 'HANDLER_LOAD_FAILED',
          message,
          hasDbUrl: Boolean(process.env.DATABASE_URL),
          node: process.version,
          cwd: process.cwd(),
        },
      }),
    );
  }
};
