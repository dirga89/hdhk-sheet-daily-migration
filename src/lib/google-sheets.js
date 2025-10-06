// Client-side Google Sheets service
export class GoogleSheetsService {
  extractSpreadsheetId(url) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  async getWorksheets(spreadsheetId) {
    try {
      const response = await fetch(`/api/sheets/${spreadsheetId}/worksheets`);
      if (!response.ok) {
        throw new Error('Failed to fetch worksheets');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching worksheets:', error);
      throw error;
    }
  }

  async getWorksheetData(spreadsheetId, worksheetName) {
    try {
      const response = await fetch(`/api/sheets/${spreadsheetId}/worksheets/${encodeURIComponent(worksheetName)}/data`);
      if (!response.ok) {
        throw new Error('Failed to fetch worksheet data');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching worksheet data:', error);
      throw error;
    }
  }
}

export const googleSheetsService = new GoogleSheetsService();
