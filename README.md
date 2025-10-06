# Google Sheets Viewer

A Next.js web application that allows users to view and explore Google Sheets data with real Google OAuth authentication, Google Sheets API integration, and database insertion capabilities.

## Features

- 🔐 **Real Google OAuth authentication**
- 📊 **View Google Sheets by URL** (real data, not mock)
- 📋 **Browse available worksheets/tabs** (actual sheet names)
- 📈 **Display worksheet data** in a clean table format
- 🎨 **Modern, responsive UI** with Tailwind CSS
- ✅ **Production-ready** Google Sheets API integration
- 🚀 **Written in JavaScript** for easy debugging and understanding
- 🗄️ **Database integration** with connection status and data insertion
- ☑️ **Row selection** with checkboxes and shift+click for ranges

## 🚀 **Current Status: FULLY IMPLEMENTED!**

This app now has:
- ✅ Complete Google OAuth 2.0 flow
- ✅ Real Google Sheets API integration
- ✅ Proper error handling for API calls
- ✅ Secure token management
- ✅ Production-ready architecture
- ✅ **JavaScript codebase** (no TypeScript complexity)
- ✅ **Database connection system** with status indicators
- ✅ **Row selection and insertion** into database

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Sheets API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Set application type to "Web application"
6. Add authorized redirect URIs:
   - `http://localhost:3000/auth/callback` (for development)
   - `https://yourdomain.com/auth/callback` (for production)
7. Copy the Client ID and Client Secret

### 3. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Google OAuth Configuration
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=your_database_name
DB_USERNAME=your_database_username
DB_PASSWORD=your_database_password
DB_DIALECT=mysql

# Database Dialect Options:
# - mysql (MySQL/MariaDB)
# - postgres (PostgreSQL)
# - sqlite (SQLite)
# - mssql (Microsoft SQL Server)
# - oracle (Oracle Database)
```

### 4. Database Setup

1. **Install database driver** (choose one based on your database):
   ```bash
   # For MySQL
   npm install mysql2
   
   # For PostgreSQL
   npm install pg
   
   # For SQLite
   npm install sqlite3
   ```

2. **Create database table** (example for MySQL):
   ```sql
   CREATE TABLE google_sheets_data (
     id INT AUTO_INCREMENT PRIMARY KEY,
     spreadsheet_id VARCHAR(255) NOT NULL,
     worksheet_name VARCHAR(255) NOT NULL,
     row_index INT NOT NULL,
     column_values JSON NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

3. **Update API endpoints** - Replace the TODO sections in:
   - `src/app/api/database/test-connection/route.js`
   - `src/app/api/database/insert-data/route.js`

### 5. OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose "External" user type
3. Fill in app information
4. Add scopes:
   - `https://www.googleapis.com/auth/spreadsheets.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`
5. Add test users (your Google account)

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Connect Database**: Click "Test Database Connection" to verify database connectivity
2. **Authenticate**: Click "Sign in with Google" to authenticate with Google
3. **Enter Sheet URL**: Paste a Google Sheets URL (must be shared with your Google account)
4. **Select Worksheet**: Choose which tab/worksheet to view from the dropdown
5. **Select Rows**: Use checkboxes to select rows (hold Shift + click for ranges)
6. **Insert Data**: Click "Insert Into Central" to save selected rows to database

## How It Works

1. **Database Connection**: Tests connection using environment variables
2. **OAuth Flow**: User clicks "Sign in with Google" → redirected to Google → authorized → redirected back with tokens
3. **API Calls**: Frontend makes requests to Next.js API routes with authentication
4. **Google Sheets API**: Backend uses OAuth tokens to call Google Sheets API
5. **Data Insertion**: Selected rows are processed and inserted into your database

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: **JavaScript** (easy to debug and understand)
- **Styling**: Tailwind CSS
- **Authentication**: Google OAuth 2.0 (real implementation)
- **API**: Google Sheets API v4 (real integration)
- **Database**: Configurable (MySQL, PostgreSQL, SQLite, etc.)
- **State Management**: React hooks
- **Backend**: Next.js API routes with Google APIs

## Code Structure

All files are now in **JavaScript** for easy debugging:

- `src/components/GoogleSheetsViewer.js` - Main component with database integration
- `src/lib/google-sheets.js` - Google Sheets service
- `src/lib/database.js` - Database connection and operations service
- `src/lib/google-auth-utils.js` - Authentication utilities
- `src/app/api/sheets/` - API routes for Google Sheets
- `src/app/api/database/` - API routes for database operations
- `src/app/auth/` - OAuth authentication routes

## Database Integration

### Connection Status Indicators:
- 🟢 **Green**: Database connected and ready
- 🔴 **Red**: Connection failed
- 🟡 **Yellow**: Testing connection
- ⚪ **Gray**: Not connected

### Features:
- **Real-time status** - Shows connection state immediately
- **Error handling** - Displays specific connection errors
- **Environment validation** - Checks for missing configuration
- **Smart insertion** - Only allows insertion when connected

## Security Features

- OAuth 2.0 with secure token handling
- HTTP-only cookies for token storage
- Environment variable configuration for database credentials
- Proper error handling and validation
- Rate limiting considerations for Google API

## Production Deployment

- Update redirect URIs in Google Cloud Console
- Set environment variables in your hosting platform
- Use secure database connections (SSL/TLS)
- Consider using connection pooling for database
- Monitor Google API usage and quotas

## License

MIT
