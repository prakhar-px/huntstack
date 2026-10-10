# Huntstack

Huntstack is a TypeScript monorepo for building and iterating on job-search and prototype tooling. The workspace combines a Node.js API server, shared schema/client libraries, and a pair of frontend artifacts for browsing job data and previewing mockups.

## Overview

This repository is organized as a pnpm workspace with three main app artifacts and shared libraries:

- `artifacts/api-server` — Express API server with database integration and request logging
- `artifacts/linkedin-jobs-search` — Vite + React frontend for browsing LinkedIn job data
- `artifacts/mockup-sandbox` — Vite + React sandbox for UI mockups and experimentation
- `lib/*` — shared packages for API contracts, generated Zod schemas, React client helpers, and database access

## Repository structure

```text
huntstack/
├── artifacts/
│   ├── api-server/
│   ├── linkedin-jobs-search/
│   └── mockup-sandbox/
├── lib/
│   ├── api-client-react/
│   ├── api-spec/
│   ├── api-zod/
│   └── db/
├── scripts/
├── .gitignore
├── .npmrc
├── .replit
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
├── replit.md
├── README.md
└── LICENSE (if present in your repo)
```

## Stack

- TypeScript 5.9
- pnpm workspaces
- Node.js 24
- Express 5
- PostgreSQL + Drizzle ORM
- React + Vite + Tailwind CSS
- Zod validation
- OpenAPI code generation via Orval

## Getting started

### Prerequisites

- Node.js 24+
- pnpm
- PostgreSQL database if you plan to run the API server locally

### Install dependencies

```bash
pnpm install
```

### Run the workspace checks

```bash
pnpm run typecheck
pnpm run build
```

### Run individual projects

```bash
# API server
pnpm --filter @workspace/api-server run dev

# LinkedIn jobs search UI
pnpm --filter @workspace/linkedin-jobs-search run dev

# Mockup sandbox
pnpm --filter @workspace/mockup-sandbox run dev
```

### Environment variables

The API server expects:

```bash
PORT=5000
DATABASE_URL=postgresql://user:password@localhost:5432/huntstack
```

## Shared packages

- `lib/db` — Drizzle schema and database connection setup
- `lib/api-zod` — generated/validated API DTOs and runtime checks
- `lib/api-spec` — OpenAPI generation inputs and API contract tooling
- `lib/api-client-react` — React hooks and client helpers for the API layer

## Notes

- The repo uses a strict workspace setup and enforces a minimum release age for dependencies in `pnpm-workspace.yaml`.
- The API server is the source of application data for the job-search frontend and relies on environment-configured database access.
- The mockup sandbox acts as a local prototyping area for UI concepts before they are wired into the main product flow.

## Development workflow

Typical workflow for contributor work in this repo:

1. Install dependencies with `pnpm install`
2. Run `pnpm run typecheck` to catch TS issues quickly
3. Work in the relevant artifact or shared library
4. Run package-level commands for validation before committing

## License

This project is currently configured as a private workspace, so licensing should be confirmed with the repository owner before public reuse or redistribution.
