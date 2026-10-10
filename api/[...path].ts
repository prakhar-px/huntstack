import app from "../artifacts/api-server/src/app";

// Vercel serverless entry point for the API.
// The Express app is a standard (req, res) handler, so it can be exported
// directly and Vercel will route every /api/* request through it.
export default app;
