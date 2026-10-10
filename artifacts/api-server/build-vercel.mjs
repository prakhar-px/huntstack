import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";

// Bundles the Express app into a single, self-contained CommonJS file so it
// can be used as a Vercel Serverless Function without Vercel having to compile
// the (bundler-style tsconfig) TypeScript sources itself.
const artifactDir = path.dirname(fileURLToPath(import.meta.url));

async function buildVercel() {
  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/vercel.ts")],
    platform: "node",
    bundle: true,
    format: "cjs",
    target: "node22",
    outfile: path.resolve(artifactDir, "dist/vercel.cjs"),
    logLevel: "info",
    external: ["*.node"],
  });
}

buildVercel().catch((err) => {
  console.error(err);
  process.exit(1);
});
