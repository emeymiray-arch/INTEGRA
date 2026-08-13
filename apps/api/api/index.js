'use strict';

try {
  require('reflect-metadata');
  const mod = require('../dist/serverless.js');
  module.exports = typeof mod === 'function' ? mod : mod.default;
} catch (error) {
  module.exports = async function failingHandler(_req, res) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[INTEGRA] Failed to load serverless handler:', message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        data: null,
        error: {
          code: 'HANDLER_LOAD_FAILED',
          message,
        },
      }),
    );
  };
}
