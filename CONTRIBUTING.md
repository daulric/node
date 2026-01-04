# Contributing to b12

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Commit Messages](#commit-messages)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. Be kind, constructive, and professional in all interactions.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/b12.git
   cd b12
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/b12.git
   ```

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) v1.0+ (recommended) or Node.js 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (optional, for local development)
- A Supabase project (cloud or local)

### Installation

```bash
# Install dependencies
bun install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your Supabase credentials
```

### Running Locally

```bash
# Start development server
bun run dev

# Run linting
bun run lint

# Build for production
bun run build
```

### Database Setup

Run the SQL scripts in order via Supabase SQL Editor:

```
supabase/sql/01_tables.sql
supabase/sql/02_rls_policies.sql
supabase/sql/03_helper_functions.sql
supabase/sql/04_schema_management.sql
supabase/sql/05_access_control.sql
supabase/sql/06_schema_inspection.sql
```

## How to Contribute

### Types of Contributions

| Type | Description |
|------|-------------|
| 🐛 Bug fixes | Fix issues and bugs |
| ✨ Features | Add new functionality |
| 📝 Documentation | Improve docs and comments |
| 🎨 UI/UX | Improve design and user experience |
| ⚡ Performance | Optimize speed and efficiency |
| 🧪 Tests | Add or improve tests |
| 🔧 Tooling | Improve dev tools and CI/CD |

### Before You Start

1. **Check existing issues** — Someone might already be working on it
2. **Open an issue first** — For significant changes, discuss before coding
3. **Keep changes focused** — One feature/fix per pull request

## Pull Request Process

### 1. Create a Branch

```bash
# Sync with upstream
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
```

### 2. Make Your Changes

- Write clean, readable code
- Follow the existing code style
- Add comments for complex logic
- Update documentation if needed

### 3. Test Your Changes

```bash
# Run linting
bun run lint

# Build to check for errors
bun run build

# Test manually in the browser
bun run dev
```

### 4. Commit Your Changes

```bash
git add .
git commit -m "feat: add new feature description"
```

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then open a Pull Request on GitHub with:
- Clear title describing the change
- Description of what and why
- Reference to related issues (e.g., "Fixes #123")
- Screenshots for UI changes

### 6. Review Process

- Maintainers will review your PR
- Address any requested changes
- Once approved, your PR will be merged

## Code Style

### General Guidelines

- Use **TypeScript** for all new code
- Use **functional components** with React hooks
- Prefer **async/await** over callbacks
- Use **descriptive variable names**
- Keep functions small and focused

### File Naming

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `UserNav.tsx` |
| Pages | kebab-case | `page.tsx` |
| Utilities | camelCase | `utils.ts` |
| Types | PascalCase | `database.ts` |

### Component Structure

```tsx
// 1. Imports
import { useState } from 'react'

// 2. Types
interface Props {
  title: string
}

// 3. Component
export function MyComponent({ title }: Props) {
  // 4. State & hooks
  const [value, setValue] = useState('')

  // 5. Handlers
  const handleClick = () => {
    // ...
  }

  // 6. Render
  return (
    <div>
      <h1>{title}</h1>
    </div>
  )
}
```

### SQL Guidelines

- Use **lowercase** for SQL keywords (optional, but consistent)
- Use **snake_case** for table and column names
- Always add **comments** for complex queries
- Include **IF NOT EXISTS** for safety

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change, no new feature |
| `perf` | Performance improvement |
| `test` | Adding tests |
| `chore` | Maintenance tasks |

### Examples

```bash
feat(auth): add GitHub OAuth login
fix(schema): prevent deletion of system tables
docs(readme): update installation steps
refactor(api): simplify tenant creation logic
```

## Reporting Issues

### Bug Reports

Include:
- **Description** — What happened vs. what you expected
- **Steps to reproduce** — Detailed steps to recreate the issue
- **Environment** — OS, browser, Bun/Node version
- **Screenshots** — If applicable
- **Error messages** — Full error text or stack trace

### Feature Requests

Include:
- **Problem** — What problem does this solve?
- **Solution** — Your proposed solution
- **Alternatives** — Other approaches you considered
- **Context** — Why is this important?

## 🔒 Security Issues

**Do NOT open public issues for security vulnerabilities.**

See our [Security Policy](./SECURITY.md) for how to report security issues responsibly.

## 📜 License

By contributing, you agree that your contributions will be licensed under the project's [MIT License with Enhanced Liability Protection](./LICENSE).

See our [Terms of Service](./TERMS.md) for additional legal information.

---

Thank you for contributing! 🎉

