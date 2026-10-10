// Vercel Serverless Function: GET /api/linkedin/jobs
//
// See api/healthz.js for why we require the pre-built CommonJS bundle instead
// of importing the TypeScript sources directly.
const mod = require("../../artifacts/api-server/dist/vercel.cjs");

module.exports = mod.default || mod;
