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
VITE_GOOGLE_CLIENT_ID=your-google-oauth-web-client-id.apps.googleusercontent.com
```

The client will call `${VITE_BACKEND_URL}/api/v1` directly.

If `VITE_GOOGLE_CLIENT_ID` is set, the login page enables Google sign-in.

## Run

```bash
npm run dev
```
