# Google Cloud Project Setup Guide

## 🔧 **Step 1: Create Google Cloud Project**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name your project (e.g., "Google Sheets Viewer")
4. Click "Create"

## 📊 **Step 2: Enable Google Sheets API**

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Google Sheets API"
3. Click on it and click "Enable"

## 🔑 **Step 3: Create OAuth 2.0 Credentials**

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. Choose "Web application"
4. Set application name (e.g., "Google Sheets Viewer")
5. Add authorized redirect URIs:
   - `http://localhost:3000/auth/callback` (for development)
   - `https://yourdomain.com/auth/callback` (for production)
6. Click "Create"
7. **Save the Client ID and Client Secret** - you'll need these!

## 📝 **Step 4: Environment Variables**

Create a `.env.local` file in your project root:

```env
# Google OAuth Configuration
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# For production, update the redirect URI
# NEXT_PUBLIC_GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/callback
```

## 🔐 **Step 5: OAuth Consent Screen**

1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose "External" user type
3. Fill in app information:
   - App name: "Google Sheets Viewer"
   - User support email: your email
   - Developer contact information: your email
4. Add scopes:
   - `https://www.googleapis.com/auth/spreadsheets.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`
5. Add test users (your Google account)
6. Click "Save and Continue"

## 📋 **Step 6: Test the Integration**

1. Run `npm run dev`
2. Go to `http://localhost:3000`
3. Click "Sign in with Google"
4. Authorize the app
5. Enter a Google Sheets URL
6. View real data!

## 🚨 **Important Notes**

- **Never commit** `.env.local` to version control
- **Test users** must be added to OAuth consent screen during development
- **Production** requires Google verification for public use
- **Rate limits** apply to Google Sheets API calls

## 🔍 **Troubleshooting**

- **"Access blocked"**: Add your email to test users
- **"Invalid redirect URI"**: Check environment variables
- **"API not enabled"**: Enable Google Sheets API
- **"Insufficient permissions"**: Check OAuth scopes
