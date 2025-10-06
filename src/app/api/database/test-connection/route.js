import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export async function GET() {
  try {
    // Get database configuration from environment variables
    const dbConfig = {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      dialect: process.env.DB_DIALECT || 'mysql' // mysql, postgres, sqlite, etc.
    };

    // Validate required environment variables
    const requiredVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USERNAME', 'DB_PASSWORD'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      return NextResponse.json(
        { 
          error: 'Database configuration incomplete', 
          message: `Missing environment variables: ${missingVars.join(', ')}`,
          suggestion: 'Please check your .env file and ensure all database variables are set.'
        },
        { status: 500 }
      );
    }

    console.log('Testing database connection with config:', {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      username: dbConfig.username,
      dialect: dbConfig.dialect
    });

    const connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.username,
      password: dbConfig.password,
      database: dbConfig.database
    });
    await connection.ping();
    await connection.end();

    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      config: {
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        dialect: dbConfig.dialect
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Database connection test failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Database connection failed', 
        message: error.message || 'Unknown database error occurred',
        suggestion: 'Please check your database configuration and ensure the database server is running.'
      },
      { status: 500 }
    );
  }
}
