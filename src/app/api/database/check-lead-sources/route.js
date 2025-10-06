import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export async function POST(request) {
  try {
    const body = await request.json();
    const { selectedRows, columnMapping } = body;

    if (!selectedRows || !columnMapping) {
      return NextResponse.json({
        success: false,
        message: 'Missing required parameters: selectedRows and columnMapping'
      });
    }

    // Database connection configuration
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    try {
      // Extract unique hear_us_from values from selected rows
      const hearUsFromValues = new Set();
      selectedRows.forEach(row => {
        const hearUsFrom = row.data.values[columnMapping.hearUsFrom]?.formattedValue;
        if (hearUsFrom && hearUsFrom.trim()) {
          hearUsFromValues.add(hearUsFrom.trim());
        }
      });

      if (hearUsFromValues.size === 0) {
        return NextResponse.json({
          success: false,
          message: 'No hear_us_from values found in selected rows'
        });
      }

      // Check which hear_us_from values exist in the database
      const existingValues = [];
      const missingValues = [];
      const sqlQueries = [];

      for (const value of hearUsFromValues) {
        try {
          const [rows] = await connection.execute(
            'SELECT id, hear_us_from, lead_group FROM hear_us_from WHERE hear_us_from = ? AND deleted = 0',
            [value]
          );

          if (rows.length > 0) {
            existingValues.push({
              value,
              id: rows[0].id,
              leadGroup: rows[0].lead_group
            });
          } else {
            missingValues.push(value);
            // Generate SQL query for missing value
            const sqlQuery = `INSERT INTO \`hear_us_from\` (\`id\`, \`type\`, \`lead_group\`, \`hear_us_from\`, \`product\`, \`deleted\`, \`version\`, \`created_by\`, \`updated_by\`, \`created_on\`, \`updated_on\`, \`branch\`, \`status\`, \`lead_source_id\`) VALUES (uuid(), 2, 38, '${value}', 1, 0, 0, '8a8080395da6c79d015da72218ec0000', '8a8080395da6c79d015da72218ec0000', now(), now(), 9, 1, 'HDHK_____');`;
            sqlQueries.push(sqlQuery);
          }
        } catch (error) {
          console.error(`Error checking hear_us_from value "${value}":`, error);
          missingValues.push(value);
        }
      }

      await connection.end();

      return NextResponse.json({
        success: true,
        message: `Lead source validation completed`,
        data: {
          totalValues: hearUsFromValues.size,
          existingValues,
          missingValues,
          sqlQueries,
          canProceed: missingValues.length === 0
        }
      });

    } catch (error) {
      await connection.end();
      throw error;
    }

  } catch (error) {
    console.error('Lead source check error:', error);
    return NextResponse.json({
      success: false,
      message: `Failed to check lead sources: ${error.message}`
    });
  }
}
