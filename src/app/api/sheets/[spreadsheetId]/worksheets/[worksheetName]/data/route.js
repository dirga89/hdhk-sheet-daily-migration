import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClientFromRequest } from '@/lib/google-auth-utils';

export async function GET(request, { params }) {
  try {
    const { spreadsheetId, worksheetName } = await params;
    
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
    
    // Get worksheet data with safe, conservative limits
    // Use a safe range that won't exceed API limits
    const safeRange = `${worksheetName}!A1:Z1000`; // 26 columns × 1000 rows
    
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: safeRange,
      });

      // Transform the data to match our interface
      const worksheetData = response.data.values?.map(row => ({
        values: row.map(cell => ({ 
          formattedValue: cell?.toString() || '' 
        }))
      })) || [];

      // Calculate actual dimensions from the data
      const actualRows = worksheetData.length;
      const actualCols = worksheetData.length > 0 ? worksheetData[0].values.length : 0;

      // Add metadata about the range fetched
      const result = {
        data: worksheetData,
        metadata: {
          totalRows: actualRows,
          totalColumns: actualCols,
          fetchedRows: actualRows,
          fetchedColumns: actualCols,
          note: actualRows >= 1000 || actualCols >= 26 
            ? `Showing first 1000 rows and 26 columns (Z). If you need more data, consider splitting large worksheets.`
            : 'All data loaded successfully'
        }
      };

      return NextResponse.json(result);
      
    } catch (rangeError) {
      // If the range is still too large, try with an even smaller range
      if (rangeError.message && rangeError.message.includes('exceeds grid limits')) {
        try {
          const smallerRange = `${worksheetName}!A1:M500`; // 13 columns × 500 rows
          const fallbackResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: smallerRange,
          });

          const fallbackData = fallbackResponse.data.values?.map(row => ({
            values: row.map(cell => ({ 
              formattedValue: cell?.toString() || '' 
            }))
          })) || [];

          const result = {
            data: fallbackData,
            metadata: {
              totalRows: fallbackData.length,
              totalColumns: fallbackData.length > 0 ? fallbackData[0].values.length : 0,
              fetchedRows: fallbackData.length,
              fetchedColumns: fallbackData.length > 0 ? fallbackData[0].values.length : 0,
              note: `This worksheet is very large and exceeded API limits. Showing first 500 rows and 13 columns (M). Consider splitting this worksheet into smaller ones.`
            }
          };

          return NextResponse.json(result);
        } catch (fallbackError) {
          return NextResponse.json(
            { 
              error: 'Worksheet too large', 
              message: 'This worksheet contains too much data and cannot be loaded even with reduced limits.',
              suggestion: 'Please split this worksheet into smaller ones or contact support.'
            },
            { status: 413 }
          );
        }
      }
      
      throw rangeError;
    }
    
  } catch (error) {
    console.error('Error fetching worksheet data:', error);
    
    // Handle specific Google API errors
    if (error.code === 403) {
      return NextResponse.json(
        { error: 'Access denied', message: 'You do not have permission to access this worksheet' },
        { status: 403 }
      );
    }
    
    if (error.code === 404) {
      return NextResponse.json(
        { error: 'Worksheet not found', message: 'The worksheet name is invalid or does not exist' },
        { status: 404 }
      );
    }

    // Handle grid limits error specifically
    if (error.message && error.message.includes('exceeds grid limits')) {
      return NextResponse.json(
        { 
          error: 'Data too large', 
          message: 'This worksheet contains too much data. Try selecting a smaller range or contact support.',
          suggestion: 'Consider splitting large worksheets into smaller ones'
        },
        { status: 413 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch worksheet data', message: error.message || 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
