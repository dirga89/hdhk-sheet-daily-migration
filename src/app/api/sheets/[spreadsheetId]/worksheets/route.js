import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClientFromRequest } from '@/lib/google-auth-utils';

export async function GET(request, { params }) {
  try {
    const { spreadsheetId } = await params;
    
    // Get authenticated OAuth client
    const oauth2Client = getAuthenticatedClientFromRequest(request);
    if (!oauth2Client) {
      return NextResponse.json(
        { error: 'Authentication required', message: 'Please sign in with Google first' },
        { status: 401 }
      );
    }

    // Create Google Sheets API client
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    
    // Get spreadsheet metadata
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    // Extract worksheet information
    const worksheets = response.data.sheets?.map(sheet => ({
      title: sheet.properties?.title || '',
      gridProperties: {
        rowCount: sheet.properties?.gridProperties?.rowCount || 0,
        columnCount: sheet.properties?.gridProperties?.columnCount || 0,
      }
    })) || [];

    return NextResponse.json(worksheets);
    
  } catch (error) {
    console.error('Error fetching worksheets:', error);
    
    // Handle specific Google API errors
    if (error.code === 403) {
      return NextResponse.json(
        { error: 'Access denied', message: 'You do not have permission to access this spreadsheet' },
        { status: 403 }
      );
    }
    
    if (error.code === 404) {
      return NextResponse.json(
        { error: 'Spreadsheet not found', message: 'The spreadsheet ID is invalid or does not exist' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch worksheets', message: error.message || 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
