'use client';

import { useState, useEffect } from 'react';
import { googleSheetsService } from '@/lib/google-sheets';
import { databaseService } from '@/lib/database';

// Helper function to check if response is an error
function isApiError(response) {
  return response && typeof response === 'object' && 'error' in response;
}

// Helper function to check if response is worksheet data
function isWorksheetData(response) {
  return response && typeof response === 'object' && 'data' in response && 'metadata' in response;
}

export default function GoogleSheetsViewer() {
  const [sheetUrl, setSheetUrl] = useState('https://docs.google.com/spreadsheets/d/1cwfNr8dhx3US2YZq-NHANSBh1KoY_Y3g_-gMX4D5kzk/edit?gid=0#gid=0');
  const [spreadsheetId, setSpreadsheetId] = useState(null);
  const [worksheets, setWorksheets] = useState([]);
  const [selectedWorksheet, setSelectedWorksheet] = useState('');
  const [worksheetData, setWorksheetData] = useState([]);
  const [worksheetMetadata, setWorksheetMetadata] = useState(null);
  const [loadingWorksheets, setLoadingWorksheets] = useState(false);
  const [loadingWorksheetData, setLoadingWorksheetData] = useState(false);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // New state for row selection
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [lastSelectedRow, setLastSelectedRow] = useState(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);

  // Database connection state
  const [dbConnectionStatus, setDbConnectionStatus] = useState('disconnected');
  const [dbConnectionError, setDbConnectionError] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Column mapping state
  const [columnMapping, setColumnMapping] = useState({
    firstName: 2,    // Column index for first name
    lastName: 3,     // Column index for last name
    email: 10,        // Column index for email
    phone: 9,        // Column index for phone number
    gender: 4,        // Column index for gender
    birthDate:6,     // Column index for birth date
    age: 5,          // Column index for age (optional)
    occupation: 8,    // Column index for occupation/job
    registrationDate: 11, // Column index for registration date
    hearUsFrom: 12,   // Column index for "hear us from" source
    postItColumns: [1, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26] // Column indices for post_it comment
  });

  // Duplicate checking state
  const [duplicateRows, setDuplicateRows] = useState(new Set());
  const [duplicateDetails, setDuplicateDetails] = useState([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [insertionResults, setInsertionResults] = useState(null);
  
  // Lead source checking state
  const [leadSourceResults, setLeadSourceResults] = useState(null);
  const [isCheckingLeadSources, setIsCheckingLeadSources] = useState(false);

  // Check authentication status on component mount
  useEffect(() => {
    // Check if we have Google auth tokens in cookies
    const checkAuth = () => {
      const cookies = document.cookie.split(';');
      const hasAccessToken = cookies.some(cookie => 
        cookie.trim().startsWith('google_access_token=')
      );
      setIsAuthenticated(hasAccessToken);
    };

    checkAuth();
    
    // Listen for auth success from OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth') === 'success') {
      setIsAuthenticated(true);
      setError('');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Add keyboard event listeners for shift key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Reset row selection when worksheet data changes
  useEffect(() => {
    setSelectedRows(new Set());
    setSelectAll(false);
    setLastSelectedRow(null);
  }, [worksheetData]);

  const handleGoogleAuth = async () => {
    // Redirect to Google OAuth
    window.location.href = '/auth/google';
  };

  // Handle database connection
  const handleDatabaseConnection = async () => {
    setIsConnecting(true);
    setDbConnectionError(null);
    
    try {
      const result = await databaseService.testConnection();
      
      if (result.success) {
        setDbConnectionStatus('connected');
        setError(''); // Clear any previous errors
      } else {
        setDbConnectionStatus('error');
        setDbConnectionError(result.message);
      }
    } catch (error) {
      setDbConnectionStatus('error');
      setDbConnectionError(error.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleUrlSubmit = async () => {
    if (!sheetUrl.trim()) {
      setError('Please enter a Google Sheets URL');
      return;
    }

    const id = googleSheetsService.extractSpreadsheetId(sheetUrl);
    if (!id) {
      setError('Invalid Google Sheets URL. Please check the format.');
      return;
    }

    setSpreadsheetId(id);
    setError('');
    setLoadingWorksheets(true);
    
    try {
      // Call the actual API to get worksheets
      const response = await googleSheetsService.getWorksheets(id);
      
      if (isApiError(response)) {
        setError(`API Error: ${response.message || response.error}`);
        setWorksheets([]);
      } else {
        setWorksheets(response);
      }
    } catch {
      setError('Failed to load worksheets. Check the console for details.');
      setWorksheets([]);
    } finally {
      setLoadingWorksheets(false);
    }
  };

  const handleWorksheetChange = async (worksheetName) => {
    setSelectedWorksheet(worksheetName);
    
    if (!worksheetName || !spreadsheetId) {
      setWorksheetData([]);
      setWorksheetMetadata(null);
      return;
    }

    setLoadingWorksheetData(true);
    try {
      // Call the actual API to get worksheet data
      const response = await googleSheetsService.getWorksheetData(spreadsheetId, worksheetName);
      
      if (isApiError(response)) {
        setError(`API Error: ${response.message || response.error}`);
        setWorksheetData([]);
        setWorksheetMetadata(null);
      } else if (isWorksheetData(response)) {
        setWorksheetData(response.data);
        setWorksheetMetadata(response.metadata);
        setError(''); // Clear any previous errors
      } else {
        setError('Unexpected response format from API');
        setWorksheetData([]);
        setWorksheetMetadata(null);
      }
    } catch {
      setError('Failed to load worksheet data. Check the console for details.');
      setWorksheetData([]);
      setWorksheetMetadata(null);
    } finally {
      setLoadingWorksheetData(false);
    }
  };

  // Handle individual row selection with shift+click support
  const handleRowSelect = (rowIndex, event) => {
    console.log('Row selection event:', { 
      rowIndex, 
      shiftKey: event?.shiftKey, 
      isShiftPressed,
      lastSelectedRow 
    });
    
    const newSelectedRows = new Set(selectedRows);
    
    // Check if shift key is pressed (either from event or our state) and we have a previous selection
    if ((event?.shiftKey || isShiftPressed) && lastSelectedRow !== null) {
      console.log('Shift+click detected! Selecting range from', lastSelectedRow, 'to', rowIndex);
      
      const start = Math.min(lastSelectedRow, rowIndex);
      const end = Math.max(lastSelectedRow, rowIndex);
      
      // Select all rows in the range
      for (let i = start; i <= end; i++) {
        newSelectedRows.add(i);
      }
      
      console.log('Range selection complete. Selected rows:', Array.from(newSelectedRows));
    } else {
      console.log('Single row selection for row:', rowIndex);
      // Normal single row selection
      if (newSelectedRows.has(rowIndex)) {
        newSelectedRows.delete(rowIndex);
      } else {
        newSelectedRows.add(rowIndex);
      }
    }
    
    setSelectedRows(newSelectedRows);
    setLastSelectedRow(rowIndex);
    
    // Update select all state
    setSelectAll(newSelectedRows.size === worksheetData.length);
  };

  // Handle select all rows
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRows(new Set());
      setSelectAll(false);
      setLastSelectedRow(null);
    } else {
      const allRows = new Set(worksheetData.map((_, index) => index));
      setSelectedRows(allRows);
      setSelectAll(true);
      setLastSelectedRow(null);
    }
  };

  // Handle insert into database
  const handleInsertIntoCentral = async () => {
    if (selectedRows.size === 0) {
      alert('Please select at least one row to insert.');
      return;
    }

    if (dbConnectionStatus !== 'connected') {
      alert('Database not connected. Please connect to the database first.');
      return;
    }

    const selectedData = Array.from(selectedRows).map(index => ({
      rowIndex: index,
      data: worksheetData[index]
    }));

    console.log('Selected rows for insertion:', selectedData);
    
         try {
       // Clear previous insertion results and lead source results
       setInsertionResults(null);
       setLeadSourceResults(null);
       setDuplicateRows(new Set());
       setDuplicateDetails([]);
       
       // Step 1: Check lead sources first
       setIsCheckingLeadSources(true);
       const leadSourceResult = await databaseService.checkLeadSources(selectedData, columnMapping);
       
       if (!leadSourceResult.success) {
         alert(`❌ Lead source check failed: ${leadSourceResult.message}`);
         setIsCheckingLeadSources(false);
         return;
       }
       
       // Store lead source results for display
       setLeadSourceResults(leadSourceResult.data);
       
       // Check if we can proceed (all lead sources exist)
       if (!leadSourceResult.data.canProceed) {
         const missingCount = leadSourceResult.data.missingValues.length;
         const message = `⚠️ Lead Source Validation Required!\n\n` +
           `Found ${missingCount} missing lead source(s) that need to be created first:\n\n` +
           `Missing values:\n` +
           leadSourceResult.data.missingValues.map(value => `• ${value}`).join('\n') +
           `\n\nPlease run the SQL queries below in your database to create these lead sources, then try again.`;
         
         alert(message);
         setIsCheckingLeadSources(false);
         return;
       }
       
       // Step 2: Check for duplicates
       setIsCheckingDuplicates(true);
       const duplicateResult = await databaseService.checkDuplicates(selectedData, columnMapping);
      
      if (duplicateResult.success) {
        // Update duplicate state
        const duplicateRowIndices = new Set(duplicateResult.duplicateDetails.map(d => d.rowIndex));
        setDuplicateRows(duplicateRowIndices);
        setDuplicateDetails(duplicateResult.duplicateDetails);
        
        // Show duplicate alert
        if (duplicateResult.duplicateRows > 0) {
          const shouldContinue = confirm(
            `Found ${duplicateResult.duplicateRows} duplicate rows out of ${duplicateResult.totalRows} total rows.\n\n` +
            `Duplicates will be skipped. Continue with insertion of ${duplicateResult.newRows} new rows?`
          );
          
          if (!shouldContinue) {
            setIsCheckingDuplicates(false);
            return;
          }
        }
        
        // Step 2: Insert non-duplicate rows
        const nonDuplicateData = selectedData.filter(row => !duplicateRowIndices.has(row.rowIndex));
        
        if (nonDuplicateData.length > 0) {
          const result = await databaseService.insertData({
            spreadsheetId,
            worksheetName: selectedWorksheet,
            selectedRows: nonDuplicateData,
            columnMapping
          });

          // Debug: Log the actual response structure
          console.log('🔍 Database insertion result:', result);
          console.log('🔍 Result structure:', {
            success: result.success,
            message: result.message,
            totalRows: result.totalRows,
            successfulRows: result.successfulRows,
            failedRows: result.failedRows,
            skippedRows: result.skippedRows,
            insertionResults: result.insertionResults,
            data: result.data
          });
          
          if (result.success) {
            // Create detailed success message
            let message = `✅ Data processing completed!\n\n`;
            message += `📊 Summary:\n`;
            message += `• Total rows processed: ${result.totalRows || result.data?.totalRows || 'Unknown'}\n`;
            message += `• Successfully inserted: ${result.successfulRows || result.data?.successfulRows || 'Unknown'}\n`;
            message += `• Failed to process: ${result.failedRows || result.data?.failedRows || 0}\n`;
            message += `• Skipped (duplicates/errors): ${result.skippedRows || result.data?.skippedRows || 0}\n\n`;
            
            // Safely access insertion results with fallbacks
            const insertionResults = result.insertionResults || result.data?.insertionResults || {
              successful: [],
              failed: [],
              skipped: []
            };
            
            if (insertionResults.failed && insertionResults.failed.length > 0) {
              message += `❌ Failed rows:\n`;
              insertionResults.failed.forEach(row => {
                message += `• Row ${row.rowIndex + 1}: ${row.email || row.phone} - ${row.reason}\n`;
              });
              message += `\n`;
            }
            
            if (insertionResults.skipped && insertionResults.skipped.length > 0) {
              message += `⚠️ Skipped rows:\n`;
              insertionResults.skipped.forEach(row => {
                message += `• Row ${row.rowIndex + 1}: ${row.email || row.phone} - ${row.reason}\n`;
              });
            }
            
            alert(message);
            
            // Store insertion results for display
            setInsertionResults(insertionResults);
            
            // Clear selection and duplicates after successful insertion
            setSelectedRows(new Set());
            setSelectAll(false);
            setDuplicateRows(new Set());
            setDuplicateDetails([]);
          } else {
            alert(`❌ Failed to insert data: ${result.message}`);
          }
        } else {
          alert('All selected rows are duplicates. No data was inserted.');
        }
      } else {
        alert(`❌ Duplicate check failed: ${duplicateResult.message}`);
      }
    } catch (error) {
      alert(`❌ Error processing data: ${error.message}`);
      console.error('Insert error:', error);
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  // Handle column mapping change
  const handleColumnMappingChange = (field, value) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: parseInt(value) || 0
    }));
  };

  // Get database status display
  const getDatabaseStatusDisplay = () => {
    switch (dbConnectionStatus) {
      case 'connected':
        return {
          color: 'bg-green-500',
          text: 'Database Connected',
          icon: '🟢'
        };
      case 'connecting':
        return {
          color: 'bg-yellow-500',
          text: 'Connecting...',
          icon: '🟡'
        };
      case 'error':
        return {
          color: 'bg-red-500',
          text: 'Connection Failed',
          icon: '🔴'
        };
      default:
        return {
          color: 'bg-gray-500',
          text: 'Not Connected',
          icon: '⚪'
        };
    }
  };

  const dbStatus = getDatabaseStatusDisplay();

  return (
    <div className="space-y-6">
      {/* Authentication Section */}
      {!isAuthenticated ? (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Google Authentication Required</h2>
          <p className="text-gray-600 mb-4">
            You need to authenticate with Google to access Google Sheets.
          </p>
          <button
            onClick={handleGoogleAuth}
            disabled={loadingWorksheets || loadingWorksheetData}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loadingWorksheets || loadingWorksheetData ? 'Authenticating...' : 'Sign in with Google'}
          </button>
        </div>
      ) : (
        <>
          {/* Database Connection Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Database Connection</h2>
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-4 h-4 rounded-full ${dbStatus.color}`}></div>
              <span className="text-lg font-medium">{dbStatus.icon} {dbStatus.text}</span>
              {dbConnectionError && (
                <span className="text-red-600 text-sm">{dbConnectionError}</span>
              )}
            </div>
            
            {dbConnectionStatus === 'connected' ? (
              <div className="text-green-700 text-sm">
                ✅ Database is ready for data insertion
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={handleDatabaseConnection}
                  disabled={isConnecting}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isConnecting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></div>
                      Testing Connection...
                    </>
                  ) : (
                    'Test Database Connection'
                  )}
                </button>
                <div className="text-sm text-gray-600">
                  <p>💡 Make sure you have configured your database connection in the <code className="bg-gray-100 px-1 rounded">.env</code> file</p>
                </div>
              </div>
            )}
          </div>

          {/* URL Input Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Enter Google Sheets URL</h2>
            <div className="flex gap-3">
              <input
                type="url"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
              <button
                onClick={handleUrlSubmit}
                disabled={loadingWorksheets}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loadingWorksheets ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></div>
                    Loading...
                  </>
                ) : (
                  'Load Sheet'
                )}
              </button>
            </div>
            {error && <p className="text-red-600 mt-2">{error}</p>}
            
            {/* Show loading state when worksheets are being fetched */}
            {loadingWorksheets && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-center gap-3 text-blue-700">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <span className="text-sm">Fetching worksheets from Google Sheets...</span>
                </div>
              </div>
            )}
          </div>

          {/* Success Message */}
          {spreadsheetId && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-green-900 mb-2">✅ Ready to View Sheets!</h3>
              <p className="text-green-700 mb-3">
                You&apos;re now authenticated with Google and can view real Google Sheets data!
              </p>
              <div className="text-sm text-green-600">
                <p><strong>Spreadsheet ID:</strong> {spreadsheetId}</p>
                <p><strong>Status:</strong> Connected to Google Sheets API</p>
              </div>
            </div>
          )}

          {/* Worksheet Selection */}
          {worksheets.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">Select Worksheet</h2>
              <div className="flex items-center gap-3">
                <select
                  value={selectedWorksheet}
                  onChange={(e) => handleWorksheetChange(e.target.value)}
                  disabled={loadingWorksheetData}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 disabled:opacity-50"
                >
                  <option value="">Choose a worksheet...</option>
                  {worksheets.map((worksheet) => (
                    <option key={worksheet.title} value={worksheet.title}>
                      {worksheet.title} ({worksheet.gridProperties.rowCount} rows, {worksheet.gridProperties.columnCount} columns)
                    </option>
                  ))}
                </select>
                {loadingWorksheetData && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <span className="text-sm">Loading data...</span>
                  </div>
                )}
              </div>
              
              {/* Show loading state when no worksheet is selected */}
              {!selectedWorksheet && !loadingWorksheetData && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-center text-blue-700">
                    <p className="text-sm">📋 Select a worksheet above to view its data</p>
                  </div>
                </div>
              )}
              
              {/* Show loading state when worksheet is selected but data is loading */}
              {selectedWorksheet && loadingWorksheetData && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-center gap-3 text-blue-700">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <span className="text-sm">Loading data for &quot;{selectedWorksheet}&quot;...</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Data Display */}
          {loadingWorksheetData && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-lg text-gray-600">Loading worksheet data...</p>
                  <p className="text-sm text-gray-500">Please wait while we fetch the data from Google Sheets</p>
                </div>
              </div>
            </div>
          )}
          
          {!loadingWorksheetData && worksheetData.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">
                Worksheet: {selectedWorksheet}
              </h2>
              
              {/* Column Mapping Configuration */}
              <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 mb-3">📋 Column Mapping Configuration</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Map your Google Sheet columns to database fields. Column indices start from 0.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input
                      type="number"
                      min="0"
                      value={columnMapping.firstName}
                      onChange={(e) => handleColumnMappingChange('firstName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input
                      type="number"
                      min="0"
                      value={columnMapping.lastName}
                      onChange={(e) => handleColumnMappingChange('lastName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="number"
                      min="0"
                      value={columnMapping.email}
                      onChange={(e) => handleColumnMappingChange('email', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="number"
                      min="0"
                      value={columnMapping.phone}
                      onChange={(e) => handleColumnMappingChange('phone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                    <input
                      type="number"
                      min="0"
                      value={columnMapping.gender}
                      onChange={(e) => handleColumnMappingChange('gender', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Values: male/m/f/男 → 1, female/f/女 → 2
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Birth Date</label>
                    <input
                      type="number"
                      min="0"
                      value={columnMapping.birthDate}
                      onChange={(e) => handleColumnMappingChange('birthDate', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Format: MM/DD/YYYY (e.g., 11/18/1976)
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                    <input
                      type="number"
                      min="0"
                      value={columnMapping.age}
                      onChange={(e) => handleColumnMappingChange('age', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Optional - will calculate from birth date if empty
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Occupation</label>
                    <input
                      type="number"
                      min="0"
                      value={columnMapping.occupation}
                      onChange={(e) => handleColumnMappingChange('occupation', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Will be stored as job_text in profile table
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Registration Date</label>
                    <input
                      type="number"
                      min="0"
                      value={columnMapping.registrationDate}
                      onChange={(e) => handleColumnMappingChange('registrationDate', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Formats: 2025-01-04T00:34:25+08:00, 5/31/25
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hear Us From</label>
                    <input
                      type="number"
                      min="0"
                      value={columnMapping.hearUsFrom}
                      onChange={(e) => handleColumnMappingChange('hearUsFrom', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Post It Columns</label>
                    <input
                      type="text"
                      value={columnMapping.postItColumns.join(', ')}
                      onChange={(e) => {
                        const columns = e.target.value.split(',').map(col => parseInt(col.trim())).filter(col => !isNaN(col));
                        handleColumnMappingChange('postItColumns', columns);
                      }}
                      placeholder="1, 13, 14, 15, 16, 17"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Multiple columns separated by commas. Will be combined into one comment with line breaks.
                    </p>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  💡 <strong>Tip:</strong> Look at your data below to determine the correct column indices. 
                  Column 0 is the first column, Column 1 is the second, etc.
                </div>
              </div>
              
              {/* Metadata Display */}
              {worksheetMetadata && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm text-blue-800">
                    <p><strong>Total Size:</strong> {worksheetMetadata.totalRows} rows × {worksheetMetadata.totalColumns} columns</p>
                    <p><strong>Loaded:</strong> {worksheetMetadata.fetchedRows} rows × {worksheetMetadata.fetchedColumns} columns</p>
                    {worksheetMetadata.note && (
                      <p className="mt-2 text-blue-700 italic">{worksheetMetadata.note}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Row Selection Summary */}
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="text-sm text-yellow-800">
                  <p><strong>Row Selection:</strong> {selectedRows.size} of {worksheetData.length} rows selected</p>
                  <p className="text-xs text-yellow-600">
                    💡 <strong>Pro tip:</strong> Hold Shift + click to select multiple rows at once!
                    {isShiftPressed && <span className="ml-2 text-green-600 font-bold">⇧ SHIFT ACTIVE</span>}
                  </p>
                  {dbConnectionStatus === 'connected' ? (
                    <p className="text-xs text-green-600 mt-1">
                      ✅ Database connected - ready to insert selected rows
                    </p>
                  ) : (
                    <p className="text-xs text-red-600 mt-1">
                      ❌ Database not connected - connect first to insert data
                    </p>
                  )}
                  {duplicateRows.size > 0 && (
                     <p className="text-xs text-orange-600 mt-1">
                       ⚠️ {duplicateRows.size} duplicate row(s) detected - will be skipped during insertion
                     </p>
                   )}
                   {leadSourceResults && !leadSourceResults.canProceed && (
                     <p className="text-xs text-red-600 mt-1">
                       ❌ {leadSourceResults.missingValues.length} missing lead source(s) - must be created before import
                     </p>
                   )}
                </div>
              </div>

              {/* Lead Source Validation Results */}
               {leadSourceResults && (
                 <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                   <h4 className="text-sm font-medium text-blue-800 mb-2">
                     🔍 Lead Source Validation Results
                   </h4>
                   <div className="space-y-2">
                     <div className="text-xs text-blue-700">
                       <strong>Total lead sources found:</strong> {leadSourceResults.totalValues}
                     </div>
                     <div className="text-xs text-green-700">
                       <strong>✅ Existing:</strong> {leadSourceResults.existingValues.length} 
                       {leadSourceResults.existingValues.length > 0 && (
                         <span className="ml-2">
                           ({leadSourceResults.existingValues.map(v => v.value).join(', ')})
                         </span>
                       )}
                     </div>
                     {leadSourceResults.missingValues.length > 0 && (
                       <div className="text-xs text-red-700">
                         <strong>❌ Missing:</strong> {leadSourceResults.missingValues.length}
                         <span className="ml-2">
                           ({leadSourceResults.missingValues.join(', ')})
                         </span>
                       </div>
                     )}
                   </div>
                   
                   {leadSourceResults.canProceed ? (
                     <div className="text-xs text-green-700 mt-2 font-medium">
                       ✅ All lead sources exist - ready to proceed with import
                     </div>
                   ) : (
                     <div className="mt-3">
                       <div className="text-xs text-red-700 mb-2 font-medium">
                         ❌ Missing lead sources detected - import cannot proceed
                       </div>
                       <div className="text-xs text-gray-700 mb-2">
                         Please run the following SQL queries in your database to create the missing lead sources:
                       </div>
                       <div className="bg-gray-100 p-2 rounded text-xs font-mono text-gray-800 max-h-32 overflow-y-auto">
                         {leadSourceResults.sqlQueries.map((query, index) => (
                           <div key={index} className="mb-1">
                             {query}
                           </div>
                         ))}
                       </div>
                       <button
                         onClick={() => {
                           const allQueries = leadSourceResults.sqlQueries.join('\n\n');
                           navigator.clipboard.writeText(allQueries);
                           alert('SQL queries copied to clipboard!');
                         }}
                         className="text-xs text-blue-600 hover:text-blue-800 underline mt-2"
                       >
                         📋 Copy All SQL Queries
                       </button>
                     </div>
                   )}
                 </div>
               )}
               
               {/* Duplicate Details Display */}
               {duplicateDetails.length > 0 && (
                 <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                   <h4 className="text-sm font-medium text-orange-800 mb-2">⚠️ Duplicate Details</h4>
                   <div className="space-y-1">
                     {duplicateDetails.map((detail, index) => (
                       <div key={index} className="text-xs text-orange-700">
                         <strong>Row {detail.rowIndex + 1}:</strong> {detail.reason} 
                         {detail.existingProfileId && ` (Profile ID: ${detail.existingProfileId})`}
                       </div>
                     ))}
                   </div>
                   <p className="text-xs text-orange-600 mt-2">
                     These rows will be automatically skipped during insertion to avoid duplicates.
                   </p>
                 </div>
               )}
              
              {/* Insertion Results Display */}
              {insertionResults && (
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">📊 Last Insertion Results</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">{insertionResults.successful.length}</div>
                      <div className="text-sm text-green-700">Successfully Inserted</div>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-red-600">{insertionResults.failed.length}</div>
                      <div className="text-sm text-red-700">Failed to Process</div>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-orange-600">{insertionResults.skipped.length}</div>
                      <div className="text-sm text-orange-700">Skipped (Duplicates/Errors)</div>
                    </div>
                  </div>
                  
                  {/* Detailed Results */}
                  {insertionResults.failed.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium text-red-700 mb-2">❌ Failed Rows:</h4>
                      <div className="space-y-1">
                        {insertionResults.failed.map((row, index) => (
                          <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                            <strong>Row {row.rowIndex + 1}:</strong> {row.email || row.phone} - {row.reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {insertionResults.skipped.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium text-orange-700 mb-2">⚠️ Skipped Rows:</h4>
                      <div className="space-y-1">
                        {insertionResults.skipped.map((row, index) => (
                          <div key={index} className="text-sm text-orange-600 bg-orange-50 p-2 rounded">
                            <strong>Row {row.rowIndex + 1}:</strong> {row.email || row.phone} - {row.reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={() => setInsertionResults(null)}
                    className="text-sm text-gray-500 hover:text-gray-700 underline"
                  >
                    Clear Results
                  </button>
                </div>
              )}
              
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50">
                      {/* Select All Checkbox */}
                      <th className="px-2 py-2 border border-gray-200 text-center">
                        <input
                          type="checkbox"
                          checked={selectAll}
                          onChange={handleSelectAll}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                      </th>
                      {worksheetData[0]?.values.map((_, index) => (
                        <th key={index} className="px-4 py-2 border border-gray-200 text-left font-medium text-gray-900">
                          Column {index + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {worksheetData.map((row, rowIndex) => (
                      <tr key={rowIndex} className={`${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${
                        duplicateRows.has(rowIndex) ? 'border-2 border-orange-300 bg-orange-50' : ''
                      }`}>
                        {/* Row Checkbox */}
                        <td className="px-2 py-2 border border-gray-200 text-center">
                          <input
                            type="checkbox"
                            checked={selectedRows.has(rowIndex)}
                            onChange={() => {}} // Keep this for controlled component
                            onClick={(e) => handleRowSelect(rowIndex, e)}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                            disabled={duplicateRows.has(rowIndex)}
                          />
                          {duplicateRows.has(rowIndex) && (
                            <div className="text-xs text-orange-600 mt-1">
                              ⚠️ Duplicate
                            </div>
                          )}
                        </td>
                        {row.values.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-4 py-2 border border-gray-200 text-gray-900">
                            {cell.formattedValue}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

                     {/* Floating Insert Button - Only show if database is connected */}
           {selectedRows.size > 0 && dbConnectionStatus === 'connected' && (
             <div className="fixed bottom-6 right-6 z-50">
               <button
                 onClick={handleInsertIntoCentral}
                 disabled={isCheckingDuplicates || isCheckingLeadSources}
                 className="bg-purple-600 text-white px-6 py-4 rounded-full shadow-lg hover:bg-purple-700 transform hover:scale-105 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 {isCheckingLeadSources ? (
                   <>
                     <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                     Checking Lead Sources...
                   </>
                 ) : isCheckingDuplicates ? (
                   <>
                     <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                     Checking Duplicates...
                   </>
                 ) : (
                   <>
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                     </svg>
                     Insert Into Central ({selectedRows.size})
                     {duplicateRows.size > 0 && (
                       <span className="text-xs bg-orange-500 px-2 py-1 rounded-full">
                         {duplicateRows.size} duplicates
                       </span>
                     )}
                     {leadSourceResults && !leadSourceResults.canProceed && (
                       <span className="text-xs bg-red-500 px-2 py-1 rounded-full">
                         {leadSourceResults.missingValues.length} missing lead sources
                       </span>
                     )}
                   </>
                 )}
               </button>
             </div>
           )}
        </>
      )}
    </div>
  );
}
