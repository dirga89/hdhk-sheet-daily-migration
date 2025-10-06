import { OAuth2Client } from 'google-auth-library';

export function getAuthenticatedClient() {
  try {
    // Note: This function is for server-side use with cookies() from next/headers
    // For API routes, use getAuthenticatedClientFromRequest instead
    console.warn('getAuthenticatedClient() is deprecated. Use getAuthenticatedClientFromRequest() for API routes.');
    return null;
  } catch (error) {
    console.error('Error getting authenticated client:', error);
    return null;
  }
}

export function getAuthenticatedClientFromRequest(request) {
  try {
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return null;

    const cookies = Object.fromEntries(
      cookieHeader.split(';').map(cookie => {
        const [name, value] = cookie.trim().split('=');
        return [name, value];
      })
    );

    const accessToken = cookies['google_access_token'];
    if (!accessToken) return null;

    const oauth2Client = new OAuth2Client(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: accessToken
    });

    return oauth2Client;
  } catch (error) {
    console.error('Error getting authenticated client from request:', error);
    return null;
  }
}
