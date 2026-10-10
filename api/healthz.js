// Vercel Serverless Function: GET /api/healthz
//
// The Express app is pre-bundled to plain CommonJS by
// `@workspace/api-server`'s `build:vercel` script (run in the Vercel build
// command). Requiring the pre-built bundle means Vercel never has to compile
// the workspace's TypeScript (whose bundler-style tsconfig its strict
// nodenext type-checker rejects).
const mod = require("../artifacts/api-server/dist/vercel.cjs");

module.exports = mod.default || mod;
