# Server Setup Notes

## Google Login Environment

Add this to your `.env.local`:

```env
GOOGLE_CLIENT_ID=your-google-oauth-web-client-id.apps.googleusercontent.com
```

Google login endpoint:

- `POST /api/v1/user/google-sign-in`
- Body: `{ "idToken": "<google-id-token>" }`

The backend verifies the Google ID token, links/creates a user, and returns the same session token format as normal sign-in.
