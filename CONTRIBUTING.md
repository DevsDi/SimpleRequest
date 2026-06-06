# Contributing to SimpleRequest

Thank you for your interest in contributing to SimpleRequest! This document provides guidelines for contributing.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 16+ and npm 8+
- [Google Chrome](https://www.google.com/chrome/) for testing
- A code editor (VS Code recommended)

### Setup

```bash
git clone https://github.com/DevsDi/SimpleRequest.git
cd SimpleRequest
npm install
npm run dev
```

### Build

```bash
npm run build
```

Load the `dist/` folder as an unpacked extension in Chrome to test.

## Development Workflow

1. **Create a branch** from `main` for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** — follow existing code style and conventions

3. **Test your changes** — load the extension in Chrome and verify manually

4. **Lint your code**:
   ```bash
   npm run lint
   ```

5. **Commit** with a clear message following [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat: add new feature
   fix: resolve bug in X
   optimize: improve performance of Y
   refactor: restructure Z module
   ```

6. **Push and open a Pull Request** against the `main` branch

## Code Style

- **Language**: TypeScript for all source files
- **Framework**: React 18 with functional components and hooks
- **State**: Zustand store in `src/store/index.ts`
- **Styling**: SCSS modules, co-located with components
- **Comments**: English, explain purpose and reasoning
- **Naming**: Meaningful variable/function names — avoid abbreviations like `a`, `b`, `tmp`
- **Error handling**: Explicit — never silently ignore errors

## Project Structure

```
src/
├── popup/components/     # UI components (one folder per component)
│   ├── RequestPanel/     # Request building UI
│   ├── ResponsePanel/    # Response display UI
│   ├── HistoryPanel/     # History list UI
│   └── VariablesPanel/   # Variable management UI
├── background/           # Service Worker (HTTP execution, CORS handling)
├── services/             # Business logic (request, curl parser, variables, storage)
├── store/                # Zustand global state
├── types/                # TypeScript type definitions
└── utils/                # Constants and utility functions
```

## Pull Request Guidelines

- **One PR per feature or fix** — keep changes focused
- **Clear description** — explain what the PR does and why
- **Link issues** — reference any related issues
- **No debug code** — remove console.log, debug flags, etc.
- **No sensitive data** — never commit credentials, tokens, or .env files

## Reporting Issues

When filing a bug report, please include:

1. **Steps to reproduce** — detailed steps
2. **Expected behavior** — what should happen
3. **Actual behavior** — what happens instead
4. **Environment** — Chrome version, OS, extension version
5. **Screenshots** — if applicable

## Feature Requests

Feature requests are welcome! Please describe:

1. **The problem** — what are you trying to accomplish?
2. **Proposed solution** — how should it work?
3. **Alternatives considered** — other approaches you've thought of

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).

## Questions?

Open an issue on [GitHub](https://github.com/DevsDi/SimpleRequest/issues) or start a discussion.
