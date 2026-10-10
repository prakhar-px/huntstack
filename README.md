# Huntstack

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-24-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Latest-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![pnpm](https://img.shields.io/badge/pnpm-Workspaces-F69220?style=for-the-badge&logo=pnpm&logoColor=white)](https://pnpm.io/)

Huntstack is a TypeScript monorepo for building and iterating on job-search and prototype tooling. The workspace combines a Node.js API server, shared schema/client libraries, and a pair of frontend artifacts for browsing job data and previewing mockups.

[Getting Started](#getting-started) • [Repository Structure](#repository-structure) • [Tech Stack](#tech-stack) • [Development](#development-workflow)

</div>

---

## Overview

This repository is organized as a pnpm workspace with three main app artifacts and shared libraries:

- **`artifacts/api-server`** — Express API server with database integration and request logging
- **`artifacts/linkedin-jobs-search`** — Vite + React frontend for browsing LinkedIn job data
- **`artifacts/mockup-sandbox`** — Vite + React sandbox for UI mockups and experimentation
- **`lib/*`** — Shared packages for API contracts, generated Zod schemas, React client helpers, and database access

## Repository structure

```
huntstack/
├── artifacts/
│   ├── api-server/              # Express.js API backend
│   ├── linkedin-jobs-search/    # Job search UI (React + Vite)
│   └── mockup-sandbox/          # Component prototyping (React + Vite)
├── lib/
│   ├── api-client-react/        # React hooks for API interaction
│   ├── api-spec/                # OpenAPI specification & code generation
│   ├── api-zod/                 # Generated Zod schemas & validation
│   └── db/                      # Drizzle ORM schemas & database setup
├── scripts/                      # Workspace utilities
├── package.json                  # Workspace root config
├── pnpm-workspace.yaml          # Workspace + dependency rules
└── tsconfig.*.json              # TypeScript configuration
```

## Tech Stack

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| ![Express](https://img.shields.io/badge/-Express-000?style=flat-square&logo=express) | 5.2.1 | REST API framework |
| ![PostgreSQL](https://img.shields.io/badge/-PostgreSQL-336791?style=flat-square&logo=postgresql&logoColor=white) | Latest | Primary database |
| ![Drizzle](https://img.shields.io/badge/-Drizzle%20ORM-C5B358?style=flat-square&logo=drizzle) | 0.45.2 | Type-safe SQL query builder |
| ![Zod](https://img.shields.io/badge/-Zod-3E67B1?style=flat-square&logo=zod) | 3.25.76 | Runtime validation |
| ![Pino](https://img.shields.io/badge/-Pino-1E1E1E?style=flat-square) | 9.14.0 | JSON logger |

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| ![React](https://img.shields.io/badge/-React-61DAFB?style=flat-square&logo=react&logoColor=black) | 19.1.0 | UI library |
| ![Vite](https://img.shields.io/badge/-Vite-646CFF?style=flat-square&logo=vite&logoColor=white) | 7.3.2 | Build tool & dev server |
| ![Tailwind](https://img.shields.io/badge/-Tailwind%20CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white) | 4.1.14 | Utility-first CSS |
| ![Radix UI](https://img.shields.io/badge/-Radix%20UI-161618?style=flat-square) | Latest | Accessible components |
| ![React Query](https://img.shields.io/badge/-React%20Query-FF4154?style=flat-square&logo=reactquery&logoColor=white) | 5.90.21 | Server state management |

### DevOps & Tooling
| Technology | Version | Purpose |
|-----------|---------|---------|
| ![pnpm](https://img.shields.io/badge/-pnpm-F69220?style=flat-square&logo=pnpm&logoColor=white) | Workspaces | Package manager |
| ![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) | 5.9.3 | Type safety |
| ![Node.js](https://img.shields.io/badge/-Node.js-339933?style=flat-square&logo=node.js&logoColor=white) | 24 | Runtime |
| ![Orval](https://img.shields.io/badge/-Orval-6B7280?style=flat-square) | 8.30.0 | OpenAPI codegen |
| ![esbuild](https://img.shields.io/badge/-esbuild-FFCF00?style=flat-square&logo=esbuild) | 0.28.2 | Bundle & build |

## Getting started

### Prerequisites

- **Node.js** 24+ ([download](https://nodejs.org/))
- **pnpm** ([installation guide](https://pnpm.io/installation))
- **PostgreSQL** (for API server development)

### Install dependencies

```bash
pnpm install
```

### Run the workspace checks

```bash
# Type checking across all packages
pnpm run typecheck

# Build all packages
pnpm run build
```

### Run individual projects

```bash
# Start API server (port 5000)
pnpm --filter @workspace/api-server run dev

# Start LinkedIn jobs search UI (dev mode)
pnpm --filter @workspace/linkedin-jobs-search run dev

# Start mockup sandbox (dev mode)
pnpm --filter @workspace/mockup-sandbox run dev
```

### Environment variables

Create a `.env` file at the root or export these variables:

```bash
# API Server
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/huntstack
```

## Shared packages

| Package | Purpose |
|---------|---------|
| **`lib/db`** | Drizzle ORM schemas, migrations, and database connection |
| **`lib/api-zod`** | Generated Zod schemas and runtime validation types |
| **`lib/api-spec`** | OpenAPI specification and code generation configuration |
| **`lib/api-client-react`** | React hooks and utilities for API consumption |

## Key features

✅ **Type-safe full stack** — TypeScript from database to frontend  
✅ **Monorepo organization** — Shared code via pnpm workspaces  
✅ **Database migrations** — Drizzle ORM with PostgreSQL  
✅ **API-driven development** — OpenAPI spec with Orval codegen  
✅ **Modern frontend** — React 19, Vite, Tailwind CSS, Radix UI  
✅ **REST API** — Express 5 with comprehensive logging  
✅ **Supply chain security** — Enforced minimum package release age  

## Development workflow

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Check types across the workspace**
   ```bash
   pnpm run typecheck
   ```

3. **Work in your target package**
   - Backend: `artifacts/api-server`
   - Frontend: `artifacts/linkedin-jobs-search` or `artifacts/mockup-sandbox`
   - Shared: `lib/*`

4. **Validate before committing**
   ```bash
   pnpm run typecheck
   pnpm run build
   ```

## Notes

- The repo uses a **strict workspace setup** with enforced dependency constraints in `pnpm-workspace.yaml`
- The **API server** is the data source for frontend applications via PostgreSQL + Drizzle
- The **mockup sandbox** is a safe environment for UI experiments before production integration
- **pnpm enforces a 1-day minimum release age** for npm packages to defend against supply-chain attacks

## License

This project is configured as a private workspace. Please confirm licensing requirements with the repository owner before public reuse or redistribution.

---

<div align="center">

**[↑ Back to top](#huntstack)**

Made with ❤️ by the Huntstack team

</div>
