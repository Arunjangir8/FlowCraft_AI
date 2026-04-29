import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './components/Auth/AuthContext'
import { env } from './config/env'

const app = (
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
)

createRoot(document.getElementById('root')!).render(
  env.googleClientId ? (
    <GoogleOAuthProvider clientId={env.googleClientId}>{app}</GoogleOAuthProvider>
  ) : (
    app
  ),
)
