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
- Direct API base URL configuration for the backend
- Starter API service and typed health check
- Starter home page showing backend connection status

## Environment

Set the backend origin in your `.env` or `.env.local` file.

```env
VITE_BACKEND_URL=https://your-backend-domain.com
```

The client will call `${VITE_BACKEND_URL}/api/v1` directly.

## Run

```bash
npm run dev
```
