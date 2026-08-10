# DH App UI

React + TypeScript frontend for the Digital Hub SA Main App, deployed on SAP BTP Cloud Foundry.

## Stack

- React 18 / TypeScript / Vite
- Tailwind CSS + SAP UI5 Web Components
- SAP BTP Cloud Foundry (static buildpack)

## Local development

```bash
npm install

# VITE_API_URL is already set in .env for local dev
npm run dev
```

## Deploy to BTP

```bash
npm run build          # outputs to dist/
cd dist
cf push dh-app         # uses public/Staticfile
```

## Environment variables

| Variable | File | Description |
|---|---|---|
| `VITE_API_URL` | `.env` | API URL for local dev (http://127.0.0.1:8000) |
| `VITE_API_URL` | `.env.production` | API URL for BTP (CF app URL) — **gitignored** |

Copy `.env.production.template` to `.env.production` and set the real URL before building for BTP.

## Project structure

```
src/
  pages/        — Full page views (AEAnalysisPage, PipelinePage, ...)
  components/   — Shared components (ShellBar, ContactsDrawer, ...)
  lib/          — Utilities, hooks, API client
  context/      — Auth context
public/         — Static assets, CF Staticfile
```
