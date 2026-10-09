# Nuggit

A small personal desktop helper (Mac first) that makes things easier to start.
See [SPEC.md](SPEC.md) for the full product spec and phases.

## Requirements

- Node.js 20+ and npm

## Run

```bash
npm install     # first time only
npm run dev     # opens the app in development mode
```

## Other scripts

```bash
npm run typecheck   # check TypeScript types
npm run lint        # lint the code
npm run build:mac   # build a macOS app into dist/
```

Your data (tasks, notes, settings) lives in the app's local data folder, never in this repo.
