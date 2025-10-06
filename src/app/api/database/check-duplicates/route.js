import { NextRequest, NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { selectedRows, columnMapping } = body;

    // Validate request data
    if (!selectedRows || !Array.isArray(selectedRows) || !columnMapping) {
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          message: 'Missing required fields: selectedRows or columnMapping' 
        },
        { status: 400 }
      );
    }

    // Get database configuration from environment variables
    const dbConfig = {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      dialect: process.env.DB_DIALECT || 'mysql'
    };

    // Validate database configuration
    const requiredVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USERNAME', 'DB_PASSWORD'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      return NextResponse.json(
        { 
          error: 'Database configuration incomplete', 
          message: `Missing environment variables: ${missingVars.join(', ')}` 
        },
        { status: 500 }
      );
    }

    console.log('Checking for duplicates:', {
      rowCount: selectedRows.length,
      columnMapping,
      dbConfig: {
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        dialect: dbConfig.dialect
      }
    });

    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.username,
      password: dbConfig.password,
      database: dbConfig.database
    });
    
    // Extract emails and phone numbers from selected rows
    const emails = selectedRows.map(row => {
      const emailIndex = columnMapping.email;
      return row.data.values[emailIndex]?.formattedValue || '';
    }).filter(email => email);
    
    // Clean and normalize phone numbers
    const phones = selectedRows.map(row => {
      const phoneIndex = columnMapping.phone;
      let phone = row.data.values[phoneIndex]?.formattedValue || '';
      
      // Clean phone number: remove letters, symbols, keep only digits
      if (phone) {
        phone = phone.replace(/[^0-9]/g, '');
      }
      
      return phone;
    }).filter(phone => phone && phone.length > 0);
    
    // Debug logging
    console.log('🔍 Extracted data:', {
      emails: emails,
      phones: phones,
      emailsLength: emails.length,
      phonesLength: phones.length,
      emailsType: typeof emails,
      phonesType: typeof phones,
      emailsIsArray: Array.isArray(emails),
      phonesIsArray: Array.isArray(phones)
    });
    
    // Log the first row data structure for debugging
    if (selectedRows.length > 0) {
      console.log('🔍 First row data structure:', {
        rowIndex: selectedRows[0].rowIndex,
        values: selectedRows[0].data.values,
        emailIndex: columnMapping.email,
        phoneIndex: columnMapping.phone,
        emailValue: selectedRows[0].data.values[columnMapping.email]?.formattedValue,
        phoneValue: selectedRows[0].data.values[columnMapping.phone]?.formattedValue
      });
    }
    
    // Check for existing emails (only if we have emails to check)
    let existingEmails = [];
    if (emails.length > 0) {
      // Generate the correct number of placeholders for IN clause
      const emailPlaceholders = emails.map(() => '?').join(',');
      const emailQuery = `SELECT profile_id, address FROM profile_email WHERE address IN (${emailPlaceholders})`;
      
      console.log('🔍 Executing email query with:', {
        query: emailQuery,
        params: emails,
        paramsType: typeof emails,
        paramsIsArray: Array.isArray(emails),
        placeholders: emailPlaceholders
      });
      
      const [emailResults] = await connection.execute(emailQuery, emails);
      existingEmails = emailResults;
    }
    
    // Check for existing phones (only if we have phones to check)
    let existingPhones = [];
    if (phones.length > 0) {
      // Generate the correct number of placeholders for IN clause
      const phonePlaceholders = phones.map(() => '?').join(',');
      const phoneQuery = `SELECT profile_id, number FROM profile_phone WHERE number IN (${phonePlaceholders})`;
      
      console.log('🔍 Executing phone query with:', {
        query: phoneQuery,
        params: phones,
        paramsType: typeof phones,
        paramsIsArray: Array.isArray(phones),
        placeholders: phonePlaceholders
      });
      
      const [phoneResults] = await connection.execute(phoneQuery, phones);
      existingPhones = phoneResults;
    }
    
    await connection.end();
    
    // Mark duplicate rows
    const duplicateRows = selectedRows.filter(row => {
      const email = row.data.values[columnMapping.email]?.formattedValue || '';
      let phone = row.data.values[columnMapping.phone]?.formattedValue || '';
      
      // Clean phone number for comparison (same logic as above)
      if (phone) {
        phone = phone.replace(/[^0-9]/g, '');
      }
      
      return existingEmails.some(existing => existing.address === email) ||
             existingPhones.some(existing => existing.number === phone);
    });

    const newRows = selectedRows.filter(row => !duplicateRows.includes(row));
    
    // Generate real duplicate details based on actual database results
    const duplicateDetails = duplicateRows.map(row => {
      const email = row.data.values[columnMapping.email]?.formattedValue || '';
      let phone = row.data.values[columnMapping.phone]?.formattedValue || '';
      
      // Clean phone number for comparison (same logic as above)
      if (phone) {
        phone = phone.replace(/[^0-9]/g, '');
      }
      
      // Check which field caused the duplicate
      const existingEmail = existingEmails.find(existing => existing.address === email);
      const existingPhone = existingPhones.find(existing => existing.number === phone);
      
      if (existingEmail) {
        return {
          rowIndex: row.rowIndex,
          reason: 'Email already exists',
          existingProfileId: existingEmail.profile_id
        };
      } else if (existingPhone) {
        return {
          rowIndex: row.rowIndex,
          reason: 'Phone number already exists',
          existingProfileId: existingPhone.profile_id
        };
      } else {
        return {
          rowIndex: row.rowIndex,
          reason: 'Duplicate detected',
          existingProfileId: null
        };
      }
    });

    console.log('Duplicate check results:', {
      totalRows: selectedRows.length,
      duplicateRows: duplicateRows.length,
      newRows: newRows.length,
      duplicateDetails
    });

    return NextResponse.json({
      success: true,
      totalRows: selectedRows.length,
      duplicateRows: duplicateRows.length,
      newRows: newRows.length,
      duplicateDetails,
      message: `Found ${duplicateRows.length} duplicate rows out of ${selectedRows.length} total rows`
    });

  } catch (error) {
    console.error('Duplicate check failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Duplicate check failed', 
        message: error.message || 'Unknown error occurred during duplicate checking',
        suggestion: 'Please check your database connection and try again.'
      },
      { status: 500 }
    );
  }
}
