# Frontend Starter (React + Vite + Tailwind)

## Folder format

```
src/
  components/
    common/
  config/
  pages/
  services/
  types/
```

## What is already set up

- Tailwind CSS via `@tailwindcss/vite`
- Vite proxy to backend (`/api` → `http://localhost:5000`)
- Starter API service and typed health check
- Starter home page showing backend connection status

## Environment

Copy `.env.example` to `.env` if needed.

```env
VITE_API_BASE_URL=/api/v1
```

Use `/api/v1` in development so requests go through the Vite proxy.

## Run

```bash
npm run dev
```
