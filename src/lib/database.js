// Database connection and operations service
export class DatabaseService {
  constructor() {
    this.isConnected = false;
    this.connectionStatus = 'disconnected'; // 'disconnected', 'connecting', 'connected', 'error'
    this.connectionError = null;
  }

  // Test database connection
  async testConnection() {
    try {
      this.connectionStatus = 'connecting';
      
      // Test connection by calling the test endpoint
      const response = await fetch('/api/database/test-connection');
      
      if (response.ok) {
        const result = await response.json();
        this.isConnected = true;
        this.connectionStatus = 'connected';
        this.connectionError = null;
        console.log('Database connection successful:', result);
        return { success: true, message: 'Database connected successfully' };
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to connect to database');
      }
    } catch (error) {
      this.isConnected = false;
      this.connectionStatus = 'error';
      this.connectionError = error.message;
      console.error('Database connection failed:', error);
      return { success: false, message: error.message };
    }
  }

  // Check for duplicate emails/phones before insertion
  async checkDuplicates(selectedRows, columnMapping) {
    try {
      const response = await fetch('/api/database/check-duplicates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ selectedRows, columnMapping }),
      });

      if (response.ok) {
        const result = await response.json();
        return result;
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to check duplicates');
      }
    } catch (error) {
      console.error('Duplicate check failed:', error);
      throw error;
    }
  }

  // Check lead sources before insertion
  async checkLeadSources(selectedRows, columnMapping) {
    try {
      const response = await fetch('/api/database/check-lead-sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ selectedRows, columnMapping }),
      });

      if (response.ok) {
        const result = await response.json();
        return result;
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to check lead sources');
      }
    } catch (error) {
      console.error('Lead source check failed:', error);
      throw error;
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      status: this.connectionStatus,
      error: this.connectionError
    };
  }

  // Insert data into database (4 tables: profile, profile_email, profile_phone, hit, post_it)
  async insertData(data) {
    if (!this.isConnected) {
      throw new Error('Database not connected. Please connect first.');
    }

    try {
      const response = await fetch('/api/database/insert-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        return { success: true, data: result };
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to insert data');
      }
    } catch (error) {
      console.error('Data insertion failed:', error);
      throw error;
    }
  }
}

export const databaseService = new DatabaseService();
