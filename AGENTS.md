# AGENTS.md - AI Agent Guidelines for ttool

This document provides instructions for AI coding agents working in this repository.

## Project Overview

A Next.js 16 application with React 19, TypeScript 5, Tailwind CSS v4, and Drizzle ORM connected to Neon PostgreSQL.

**Package Manager:** pnpm (required)

## Build, Lint, and Test Commands

```bash
# Development
pnpm dev                 # Start Next.js development server (http://localhost:3000)

# Build & Production
pnpm build               # Build production application
pnpm start               # Start production server

# Code Quality
pnpm lint                # Run ESLint

# Database Operations
pnpm db:push             # Push Drizzle schema to database
pnpm db:generate         # Generate Drizzle migrations
pnpm db:studio           # Open Drizzle Studio GUI
```

### Running Tests

No test framework is currently configured. If tests are added:
- Prefer Vitest for unit tests
- Use Playwright for E2E tests
- Single test pattern: `pnpm test -- path/to/test.test.ts`

## Project Structure

```
src/
├── app/                     # Next.js App Router
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Home page
│   ├── globals.css          # Global styles (Tailwind v4)
│   └── (pages)/             # Route groups
│       └── [route]/page.tsx # Page components
├── dbs/
│   └── drizzle/             # Database layer
│       ├── config.ts        # Drizzle Kit configuration
│       ├── index.ts         # DB client export
│       └── schema/          # Schema definitions
└── types.ts                 # Shared type definitions
```

## Code Style Guidelines

### TypeScript Configuration

- **Strict mode enabled** - All strict checks are active
- **Path alias:** Use `@/*` for imports from project root
- **Target:** ES2017 with ESNext modules

### Import Order

1. External packages (React, Next.js, third-party)
2. Internal modules (using `@/` alias)
3. Type imports (use `type` keyword)

```typescript
// External packages
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

// Internal modules
import * as schema from "@/dbs/drizzle/schema";

// Type imports
import type { Metadata } from "next";
```

### Formatting Standards

- **Indentation:** 2 spaces
- **Semicolons:** Required
- **Quotes:** Double quotes for strings
- **Trailing commas:** Yes, in objects and arrays
- **Line length:** ~80-100 characters

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files (routes) | kebab-case | `download/page.tsx` |
| Files (modules) | camelCase | `schema.ts`, `config.ts` |
| Variables/Functions | camelCase | `geistSans`, `getUserById` |
| Components | PascalCase | `Home`, `RootLayout` |
| Types/Interfaces | PascalCase | `UserProfile`, `Metadata` |
| Database tables | camelCase plural | `plans`, `stages`, `jobs` |
| Enums | camelCase + Enum suffix | `contextLevelEnum` |

### React/Next.js Patterns

```typescript
// Page components use default exports
export default function PageName() {
  return <div>...</div>;
}

// Metadata exports for pages
export const metadata: Metadata = {
  title: "Page Title",
};

// Props with Readonly wrapper
export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <html>...</html>;
}
```

### Database/Drizzle Patterns

```typescript
// Table definitions with indexes
export const tableName = pgTable(
  "table_name",
  {
    id: serial().primaryKey(),
    name: varchar({ length: 256 }).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    nameIdx: index("table_name_idx").on(t.name),
  }),
);

// Relations defined separately
export const tableRelations = relations(tableName, ({ many, one }) => ({
  relatedItems: many(otherTable),
}));
```

### Environment Variables

- Use non-null assertions for required env vars: `process.env.DATABASE_URL!`
- Store sensitive values in `.env.local` (never commit)

### Comment Style

```typescript
/* ----------------------------------
 * Section Header
 * ---------------------------------- */
```

### Error Handling

- Use try/catch for async operations that may fail
- Validate inputs at API boundaries
- Return meaningful error messages

## Styling Guidelines (Tailwind CSS v4)

- Use utility classes directly in JSX
- CSS variables for theming: `--background`, `--foreground`
- Dark mode: `@media (prefers-color-scheme: dark)`
- Geist font family via `next/font/google`

```css
/* globals.css structure */
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}
```

## Frontend Design Guidelines

When building UI components, follow these principles:

1. **Avoid generic aesthetics** - No Inter, Roboto, or Arial fonts. No purple gradients on white.
2. **Choose distinctive typography** - Pair display fonts with refined body fonts
3. **Commit to a cohesive theme** - Use CSS variables for consistency
4. **Add meaningful motion** - CSS animations for micro-interactions
5. **Create visual depth** - Gradients, textures, shadows, overlays

## ESLint Configuration

Uses ESLint 9 flat config (`eslint.config.mjs`):
- Extends `eslint-config-next/core-web-vitals`
- Extends `eslint-config-next/typescript`
- Ignores: `.next/**`, `out/**`, `build/**`

## Git Workflow

- Commit messages: Use conventional commits (`feat:`, `fix:`, `chore:`)
- Branch naming: `feature/`, `fix/`, `chore/` prefixes
- Run `pnpm lint` before committing

## Quick Reference

| Task | Command |
|------|---------|
| Start dev server | `pnpm dev` |
| Build for production | `pnpm build` |
| Run linter | `pnpm lint` |
| Push DB schema | `pnpm db:push` |
| Open DB GUI | `pnpm db:studio` |
