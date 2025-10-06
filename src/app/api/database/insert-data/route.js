import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

// Gender mapping function
function mapGenderToNumeric(rawGender) {
  if (!rawGender) return 1; // Default to male if no gender specified
  
  const normalizedGender = rawGender.toString().toLowerCase().trim();
  
  // Male mappings
  if (['male', 'm', '男'].includes(normalizedGender)) {
    return 1;
  }
  
  // Female mappings
  if (['female', 'f', '女'].includes(normalizedGender)) {
    return 2;
  }
  
  // Default to male if no match found
  console.log(`⚠️ Unknown gender value: "${rawGender}", defaulting to male (1)`);
  return 1;
}

// Date parsing function for various formats
function parseDate(dateString) {
  if (!dateString) return null;
  
  try {
    // Try ISO format first (2025-01-04T00:34:25+08:00)
    if (dateString.includes('T') || dateString.includes('+')) {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
    }
    
    // Try MM/DD/YY format (5/31/25)
    if (dateString.includes('/')) {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        let month = parseInt(parts[0]);
        let day = parseInt(parts[1]);
        let year = parseInt(parts[2]);
        
        // Handle 2-digit years
        if (year < 100) {
          year += year < 50 ? 2000 : 1900;
        }
        
        // Format as YYYY-MM-DD for MySQL
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      }
    }
    
    // Try MM/DD/YYYY format (11/18/1976)
    if (dateString.includes('/')) {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        const month = parseInt(parts[0]);
        const day = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        
        // Format as YYYY-MM-DD for MySQL
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      }
    }
    
    console.log(`⚠️ Could not parse date: "${dateString}"`);
    return null;
  } catch (error) {
    console.log(`⚠️ Error parsing date "${dateString}":`, error.message);
    return null;
  }
}

// Age calculation function
function calculateAge(birthDate) {
  if (!birthDate) return null;
  
  try {
    const today = new Date();
    const birth = new Date(birthDate);
    
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  } catch (error) {
    console.log(`⚠️ Error calculating age from birth date:`, error.message);
    return null;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { spreadsheetId, worksheetName, selectedRows, columnMapping } = body;

    // Validate request data
    if (!spreadsheetId || !worksheetName || !selectedRows || !Array.isArray(selectedRows) || !columnMapping) {
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          message: 'Missing required fields: spreadsheetId, worksheetName, selectedRows, or columnMapping' 
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

    const branch = process.env.CENTRAL_BRANCH;
    const systemUserId = process.env.CENTRAL_SYSTEM_USER_ID;
    const hitType = 3; // WEBSITE
    // const productId = 1; // Lunch Actually

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

    console.log('🔍 INSERT DATA REQUEST RECEIVED:', {
      spreadsheetId,
      worksheetName,
      rowCount: selectedRows.length,
      columnMapping
    });

    // Filter out duplicate rows within the selected data
    const uniqueRows = [];
    const seenEmails = new Set();
    const seenPhones = new Set();
    let duplicateCount = 0;

    for (const rowData of selectedRows) {
      const { rowIndex, data } = rowData;
      const values = data.values;
      
      let email = values[columnMapping.email]?.formattedValue || '';
      let phone = values[columnMapping.phone]?.formattedValue || '';
      
               // Apply DEV environment modifications for duplicate checking
         const environment = process.env.ENV || 'PROD';
         if (environment === 'DEV') {
           if (email) {
             const emailPrefix = email.split('@')[0];
             const emailProvider = email.split('@')[1];
             email = `a1b2c3_${emailPrefix}_dev@${emailProvider}`;
           }
           if (phone && phone.length >= 4) {
             const phonePrefix = phone.slice(0, -4);
             phone = `${phonePrefix}1234`;
           }
         }
      
      // Check if this row is a duplicate
      let isDuplicate = false;
      let duplicateReason = '';
      
      if (email && seenEmails.has(email)) {
        isDuplicate = true;
        duplicateReason = `Duplicate email: ${email}`;
      }
      
      if (phone && seenPhones.has(phone)) {
        isDuplicate = true;
        duplicateReason = `Duplicate phone: ${phone}`;
      }
      
      if (isDuplicate) {
        console.log(`⚠️ Row ${rowIndex}: Skipping duplicate - ${duplicateReason}`);
        duplicateCount++;
        continue;
      }
      
      // Add to unique rows and mark as seen
      uniqueRows.push(rowData);
      if (email) seenEmails.add(email);
      if (phone) seenPhones.add(phone);
    }

    console.log(`🔍 Duplicate filtering: ${selectedRows.length} total rows → ${uniqueRows.length} unique rows (${duplicateCount} duplicates removed)`);
    
    // Use uniqueRows instead of selectedRows for processing
    const rowsToProcess = uniqueRows;
    
    // 🔍 DEBUG: Log the first few rows to see structure
    if (selectedRows.length > 0) {
      console.log('🔍 First Row Sample:', {
        rowIndex: selectedRows[0].rowIndex,
        dataKeys: Object.keys(selectedRows[0].data),
        valuesLength: selectedRows[0].data.values?.length || 'NO VALUES',
        valuesSample: selectedRows[0].data.values?.slice(0, 3) || 'NO VALUES'
      });
    }
    
         console.log('🔍 Database Config:', {
       host: dbConfig.host,
       port: dbConfig.port,
       database: dbConfig.database,
       dialect: dbConfig.dialect
     });
     
     // Log all hear_us_from values that will be processed
     const allHearUsFromValues = selectedRows.map(row => {
       const values = row.data.values;
       const hearUsFrom = values[columnMapping.hearUsFrom]?.formattedValue || '';
       return { rowIndex: row.rowIndex, hearUsFrom };
     }).filter(item => item.hearUsFrom);
     
     if (allHearUsFromValues.length > 0) {
       console.log('🔍 All hear_us_from values to be processed:', allHearUsFromValues);
     } else {
       console.log('🔍 No hear_us_from values found in selected rows');
     }
    
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.username,
      password: dbConfig.password,
      database: dbConfig.database
    });
        
    // 🔍 DEBUG: Let's check the profile table structure
    try {
      const [tableInfo] = await connection.execute('DESCRIBE profile');
      console.log('🔍 Profile Table Structure:', tableInfo);
    } catch (error) {
      console.log('🔍 Could not get table structure:', error.message);
    }
    
    // Start transaction
    await connection.beginTransaction();
    
    // Track insertion results
    const insertionResults = {
      successful: [],
      failed: [],
      skipped: []
    };
    
    try {
      for (const rowData of rowsToProcess) {
        const { rowIndex, data } = rowData;
        const values = data.values;
        
        try {
          // Extract values based on column mapping
          const firstName = values[columnMapping.firstName]?.formattedValue || '';
          const lastName = values[columnMapping.lastName]?.formattedValue || '';
          let email = values[columnMapping.email]?.formattedValue || '';
          
          // Clean phone number - remove non-numeric characters
          let phone = values[columnMapping.phone]?.formattedValue || '';
          const originalPhone = phone;
          if (phone) {
            phone = phone.replace(/[^0-9]/g, '');
            if (originalPhone !== phone) {
              console.log(`🔍 Row ${rowIndex}: Phone number cleaned: "${originalPhone}" → "${phone}"`);
            }
          }
          
          // DEV environment modifications
          const environment = process.env.ENV || 'PROD';
          if (environment === 'DEV') {
            // Modify email for DEV environment
            if (email) {
              const emailPrefix = email.split('@')[0];
              const emailProvider = email.split('@')[1];
              email = `a1b2c3_${emailPrefix}_dev@${emailProvider}`;
              console.log(`🔍 Row ${rowIndex}: DEV environment - Email modified to: ${email}`);
            }
            
            // Modify phone for DEV environment (change last 4 digits to 1234)
            if (phone && phone.length >= 4) {
              const phonePrefix = phone.slice(0, -4);
              phone = `${phonePrefix}1234`;
              console.log(`🔍 Row ${rowIndex}: DEV environment - Phone modified to: ${phone}`);
            }
          }
          
          const rawGender = values[columnMapping.gender]?.formattedValue || '';
          const gender = mapGenderToNumeric(rawGender);
          
          // Extract and parse dates
          const rawBirthDate = values[columnMapping.birthDate]?.formattedValue || '';
          const birthDate = parseDate(rawBirthDate);
          
          const rawAge = values[columnMapping.age]?.formattedValue || '';
          let age = rawAge ? parseInt(rawAge) : null;
          
          // Calculate age from birth date if not provided
          if (!age && birthDate) {
            age = calculateAge(birthDate);
          }
          
          const occupation = values[columnMapping.occupation]?.formattedValue || '';
          
          const rawRegistrationDate = values[columnMapping.registrationDate]?.formattedValue || '';
          const registrationDate = parseDate(rawRegistrationDate);
          
          const hearUsFrom = values[columnMapping.hearUsFrom]?.formattedValue || '';
           
          // Combine multiple columns into post_it comment
          const postItColumns = columnMapping.postItColumns || [1, 13, 14, 15, 16, 17, 18, 19, 20]; // Use UI config or fallback
          let postItData = postItColumns
            .map(colIndex => values[colIndex]?.formattedValue || '')
            .filter(value => value.trim() !== '') // Remove empty values
            .join('\n'); // Separate with line breaks
         
         // Log the post_it combination process
         if (postItData) {
           console.log(`🔍 Row ${rowIndex}: Post-it comment created from columns:`, {
             columnsUsed: postItColumns,
             rawValues: postItColumns.map(colIndex => ({
               column: colIndex,
               value: values[colIndex]?.formattedValue || '',
               isEmpty: !values[colIndex]?.formattedValue || values[colIndex].formattedValue.trim() === ''
             })),
             finalComment: postItData
           });
         }
         
         // Log hear_us_from value for debugging
         if (hearUsFrom) {
           console.log(`🔍 Row ${rowIndex}: hear_us_from value: "${hearUsFrom}" (column index: ${columnMapping.hearUsFrom})`);
         }
        
        // 🔍 DEBUG: Log all extracted values and their types
        console.log('🔍 Row', rowIndex, 'Extracted Values:', {
           firstName: { value: firstName, type: typeof firstName, index: columnMapping.firstName },
           lastName: { value: lastName, type: typeof lastName, index: columnMapping.lastName },
           email: { value: email, type: typeof email, index: columnMapping.email },
           phone: { value: phone, type: typeof phone, index: columnMapping.phone },
           gender: { rawValue: rawGender, mappedValue: gender, type: typeof gender, index: columnMapping.gender },
           birthDate: { rawValue: rawBirthDate, parsedValue: birthDate, type: typeof birthDate, index: columnMapping.birthDate },
           age: { rawValue: rawAge, calculatedValue: age, type: typeof age, index: columnMapping.age },
           occupation: { value: occupation, type: typeof occupation, index: columnMapping.occupation },
           registrationDate: { rawValue: rawRegistrationDate, parsedValue: registrationDate, type: typeof registrationDate, index: columnMapping.registrationDate },
           hearUsFrom: { value: hearUsFrom, type: typeof hearUsFrom, index: columnMapping.hearUsFrom },
           postItData: { value: postItData, type: typeof postItData, index: columnMapping.postIt },
           systemUserId: { value: systemUserId, type: typeof systemUserId }
         });
         
         // Note: postItData will be updated with profile_id after profile insertion
        
        // 🔍 DEBUG: Log the raw values array and column mapping
        console.log('🔍 Row', rowIndex, 'Raw Values Array:', values);
        console.log('🔍 Row', rowIndex, 'Column Mapping:', columnMapping);
        
        // 🔍 DEBUG: Log the specific values being inserted
        console.log('🔍 Row', rowIndex, 'Profile Insert Values:', [firstName, lastName, systemUserId, systemUserId]);
        
        // ✅ VALIDATION: Check for undefined values before database insert
        if (firstName === undefined || lastName === undefined || systemUserId === undefined) {
          throw new Error(`Row ${rowIndex}: Undefined values detected - firstName: ${firstName}, lastName: ${lastName}, systemUserId: ${systemUserId}`);
        }
        
        // Step 1: Insert into profile table using UUID()
        console.log('🔍 Row', rowIndex, 'Inserting profile with UUID()...');
        
        // Determine created_on and updated_on dates
        let createdOn, updatedOn;
        if (registrationDate) {
          // registrationDate is already in YYYY-MM-DD format
          createdOn = registrationDate;
          updatedOn = registrationDate;
        } else {
          // Use current date in YYYY-MM-DD format
          const now = new Date();
          createdOn = now.toISOString().split('T')[0];
          updatedOn = now.toISOString().split('T')[0];
        }
        
        const profileQuery = 'INSERT INTO profile (id, first_name, last_name, gender, birthdate, age, job_text, created_on, updated_on, created_by, updated_by, deleted, version) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)';
        const profileParams = [firstName, lastName, gender, birthDate, age, occupation, createdOn, updatedOn, systemUserId, systemUserId];
        
        console.log('🔍 Row', rowIndex, 'Profile Insert Query:', {
          query: profileQuery,
          params: profileParams
        });
        
        const [profileResult] = await connection.execute(profileQuery, profileParams);
        
        console.log('🔍 Row', rowIndex, 'Profile Insert Result:', profileResult);
        
        // ✅ CRITICAL: Verify profile insert succeeded
        if (profileResult.affectedRows !== 1) {
          throw new Error(`Row ${rowIndex}: Profile insert failed - affectedRows: ${profileResult.affectedRows}`);
        }
        
        // 🔍 DEBUG: Get the UUID that was generated by searching for the record we just inserted
        console.log('🔍 Row', rowIndex, 'Getting generated UUID by searching...');
        const [searchResult] = await connection.execute(
          'SELECT id FROM profile WHERE first_name = ? AND last_name = ? AND created_by = ? ORDER BY created_on DESC LIMIT 1',
          [firstName, lastName, systemUserId]
        );
        
        if (!searchResult || searchResult.length === 0) {
          throw new Error(`Row ${rowIndex}: Could not find inserted profile record`);
        }
        
                 const profileId = searchResult[0].id;
         console.log('🔍 Row', rowIndex, 'Found Profile UUID:', profileId);
         
          // Add profile_id to post_it comment for unique identification
          if (postItData) {
            postItData = `[Profile ID: ${profileId}]\n\n${postItData}`;
            console.log(`🔍 Row ${rowIndex}: Post-it comment updated with profile ID:`, postItData);
          }
         
         // Step 2: Insert into profile_email
        if (email) {
          // ✅ VALIDATION: Check for undefined values
          if (profileId === undefined || email === undefined || systemUserId === undefined) {
            throw new Error(`Row ${rowIndex}: Undefined values for email insert - profileId: ${profileId}, email: ${email}, systemUserId: ${systemUserId}`);
          }
          
          console.log('🔍 Row', rowIndex, 'Email Insert Values:', [profileId, email, systemUserId, systemUserId]);
          
          await connection.execute(
            'INSERT INTO profile_email (id, profile_id, address, created_on, updated_on, created_by, updated_by, deleted, version) VALUES (UUID(), ?, ?, NOW(), NOW(), ?, ?, 0, 0)',
            [profileId, email, systemUserId, systemUserId]
          );
        }
        
        // Step 3: Insert into profile_phone
        if (phone) {
          // ✅ VALIDATION: Check for undefined values
          if (profileId === undefined || phone === undefined || branch === undefined || systemUserId === undefined) {
            throw new Error(`Row ${rowIndex}: Undefined values for phone insert - profileId: ${profileId}, phone: ${phone}, branch: ${branch}, systemUserId: ${systemUserId}`);
          }
          
          console.log('🔍 Row', rowIndex, 'Phone Insert Values:', [profileId, phone, branch, systemUserId, systemUserId]);
          
          await connection.execute(
            'INSERT INTO profile_phone (id, profile_id, number, branch_id, created_on, updated_on, created_by, updated_by, deleted, version) VALUES (UUID(), ?, ?, ?, NOW(), NOW(), ?, ?, 0, 0)',
            [profileId, phone, branch, systemUserId, systemUserId]
          );
        }
        
          // Step 4: Get hear_us_from ID and insert into hit
         if (hearUsFrom) {
           console.log(`🔍 Row ${rowIndex}: Looking for hear_us_from: "${hearUsFrom}" in branch: ${branch}`);
           
           const [hearUsResult] = await connection.execute(
             'SELECT id FROM hear_us_from WHERE hear_us_from = ? AND branch = ? LIMIT 1',
             [hearUsFrom, branch]
           );
           
           if (hearUsResult.length > 0) {
             const hearUsFromId = hearUsResult[0].id;
             console.log(`🔍 Row ${rowIndex}: Found hear_us_from ID: ${hearUsFromId} for "${hearUsFrom}"`);
             
                           await connection.execute(
                'INSERT INTO hit (id, profile_id, hear_us_from, created_on, updated_on, created_by, updated_by, hit_type, deleted, version, branch) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)',
                [profileId, hearUsFromId, createdOn, updatedOn, systemUserId, systemUserId, hitType, branch]
              );
              
              // Get the hit_id that was just inserted using SELECT method (same as profile and post_it)
              console.log(`🔍 Row ${rowIndex}: Getting generated hit UUID by searching...`);
              const [hitSearchResult] = await connection.execute(
                'SELECT id FROM hit WHERE profile_id = ? AND hear_us_from = ? AND created_on = ? ORDER BY created_on DESC LIMIT 1',
                [profileId, hearUsFromId, createdOn]
              );
              
              if (!hitSearchResult || hitSearchResult.length === 0) {
                throw new Error(`Row ${rowIndex}: Could not find inserted hit record`);
              }
              
              const hitId = hitSearchResult[0].id;
              console.log(`🔍 Row ${rowIndex}: Found Hit UUID: ${hitId}`);
              
              // Insert into followup table
              const todoDate = new Date(createdOn);
              todoDate.setDate(todoDate.getDate() + 1);
              const todoDateStr = todoDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
              
              await connection.execute(
                `INSERT INTO followup (
                  id, created_on, updated_on, created_by, updated_by, 
                  todo_date, todo_time, method, result, assigned_consultant, 
                  product, branch, profile_id, hit_id, followup_type, deleted, version
                ) VALUES (
                  UUID(), ?, ?, ?, ?, 
                  ?, '09:00:00', 1, 2, ?, 
                  1, ?, ?, ?, 1, 0, 0
                )`,
                [createdOn, updatedOn, systemUserId, systemUserId, todoDateStr, systemUserId, branch, profileId, hitId]
              );
              
                             console.log(`✅ Row ${rowIndex}: Inserted followup record with hit_id: ${hitId}`);
               
               // Insert two rows into profile_product_lead table
               // Row 1: Product 1 (with hit_id)
               await connection.execute(
                 'INSERT INTO profile_product_lead (id, status, deleted, product, profile_id, hit_id, created_on, updated_on, version) VALUES (UUID(), 1, 0, 1, ?, ?, ?, ?, 0)',
                 [profileId, hitId, createdOn, updatedOn]
               );
               
               // Row 2: Product 2 (without hit_id)
               await connection.execute(
                 'INSERT INTO profile_product_lead (id, status, deleted, product, profile_id, hit_id, created_on, updated_on, version) VALUES (UUID(), 1, 0, 2, ?, NULL, ?, ?, 0)',
                 [profileId, createdOn, updatedOn]
               );
               
               console.log(`✅ Row ${rowIndex}: Inserted 2 profile_product_lead records for products 1 & 2`);
                        } else {
              // ❌ CRITICAL: Stop the entire process if hear_us_from not found
              const sqlQuery = `INSERT INTO \`lagcprod\`.\`hear_us_from\`
                (\`id\`, \`type\`, \`lead_group\`, \`hear_us_from\`, \`product\`, \`deleted\`, \`version\`, \`created_by\`, \`updated_by\`, \`created_on\`, \`updated_on\`, \`branch\`, \`status\`, \`lead_source_id\`)
                VALUES
                (uuid(), 2, 38, '${hearUsFrom}', 1, 0, 0, '${systemUserId}', '${systemUserId}', now(), now(), ${branch}, 1, 'HDHK_${hearUsFrom.replace(/[^a-zA-Z0-9]/g, '_')}');`;
                              
                              const errorMessage = `Row ${rowIndex}: Cannot find hear_us_from "${hearUsFrom}" in branch ${branch}.

                📋 Copy this SQL query to MySQL Workbench:

                ${sqlQuery}

                After running the query, restart the insertion process.`;
              
              console.error(`❌ ${errorMessage}`);
              
              // Rollback the transaction and throw error to stop the process
              await connection.rollback();
              throw new Error(errorMessage);
            }
         }
        
                 // Step 5: Insert into post_it and update profile
         if (postItData) {
           console.log(`🔍 Row ${rowIndex}: Inserting post_it comment with profile ID:`, postItData);
           
           // Add debug logging to see the exact values being inserted
           console.log(`🔍 Row ${rowIndex}: Post_it INSERT values:`, {
             postItData: postItData,
             postItDataLength: postItData ? postItData.length : 0,
             postItDataType: typeof postItData,
             createdOn: createdOn,
             updatedOn: updatedOn,
             systemUserId: systemUserId
           });
           
           const [postItResult] = await connection.execute(
             'INSERT INTO post_it (id, comment, created_on, updated_on, created_by, updated_by, deleted, version) VALUES (UUID(), ?, ?, ?, ?, ?, 0, 0)',
             [postItData, createdOn, updatedOn, systemUserId, systemUserId]
           );
           
           console.log(`🔍 Row ${rowIndex}: Post_it INSERT result:`, postItResult);
           
           // ✅ CRITICAL: Get the UUID that was generated by searching for the record we just inserted
           console.log(`🔍 Row ${rowIndex}: Getting generated post_it UUID by searching...`);
           const [postItSearchResult] = await connection.execute(
             'SELECT id FROM post_it WHERE comment = ? AND created_by = ? ORDER BY created_on DESC LIMIT 1',
             [postItData, systemUserId]
           );
           
           if (!postItSearchResult || postItSearchResult.length === 0) {
             throw new Error(`Row ${rowIndex}: Could not find inserted post_it record`);
           }
           
           const postItId = postItSearchResult[0].id;
           console.log(`🔍 Row ${rowIndex}: Found Post_it UUID: ${postItId}`);
           
           // Verify what was actually inserted
           const [verifyResult] = await connection.execute(
             'SELECT id, comment, created_on, created_by FROM post_it WHERE id = ?',
             [postItId]
           );
           console.log(`🔍 Row ${rowIndex}: Verification of inserted post_it:`, verifyResult[0]);
           
           // Update profile with post_it_id
           await connection.execute(
             'UPDATE profile SET post_it = ? WHERE id = ?',
             [postItId, profileId]
           );
           console.log(`🔍 Row ${rowIndex}: Profile updated with post_it_id: ${postItId}`);
         }

         // Step 6: Insert into profile_preferences (required for profile page to load)
        console.log(`🔍 Row ${rowIndex}: Inserting profile_preferences...`);
        await connection.execute(
          'INSERT INTO profile_pref (id, profile_id, created_on, updated_on, created_by, updated_by, deleted, version) VALUES (UUID(), ?, ?, ?, ?, ?, 0, 0)',
          [profileId, createdOn, updatedOn, systemUserId, systemUserId]
        );

        // Step 7: Insert into profile_personal_info (required for profile page to load)
        console.log(`🔍 Row ${rowIndex}: Inserting profile_personal_info...`);
        await connection.execute(
          'INSERT INTO profile_personal_info (id, profile_id, created_on, updated_on, created_by, updated_by, deleted, version) VALUES (UUID(), ?, ?, ?, ?, ?, 0, 0)',
          [profileId, createdOn, updatedOn, systemUserId, systemUserId]
        );

        // Step 8: Insert into profile_interest (required for profile page to load)
        console.log(`🔍 Row ${rowIndex}: Inserting profile_interest...`);
        await connection.execute(
          'INSERT INTO profile_interest (id, profile_id, created_on, updated_on, created_by, updated_by, deleted, version) VALUES (UUID(), ?, ?, ?, ?, ?, 0, 0)',
          [profileId, createdOn, updatedOn, systemUserId, systemUserId]
        );

        // Step 9: Insert into profile_expectation (required for profile page to load)
        console.log(`🔍 Row ${rowIndex}: Inserting profile_expectation...`);
        await connection.execute(
          'INSERT INTO profile_expectation (id, profile_id, created_on, updated_on, created_by, updated_by, deleted, version) VALUES (UUID(), ?, ?, ?, ?, ?, 0, 0)',
          [profileId, createdOn, updatedOn, systemUserId, systemUserId]
        );

        // Step 10: Insert into profile_confidential_info (required for profile page to load)
        console.log(`🔍 Row ${rowIndex}: Inserting profile_confidential_info...`);
        await connection.execute(
          'INSERT INTO profile_confidential_info (id, profile_id, created_on, updated_on, created_by, updated_by, deleted, version) VALUES (UUID(), ?, ?, ?, ?, ?, 0, 0)',
          [profileId, createdOn, updatedOn, systemUserId, systemUserId]
        );

        // Step 11: Insert into profile_spoken_language (required for profile page to load)
        console.log(`🔍 Row ${rowIndex}: Inserting profile_spoken_language...`);
        await connection.execute(
          'INSERT INTO profile_spoken_language (id, profile_id, language, created_on, updated_on, created_by, updated_by, deleted, version) VALUES (UUID(), ?, 1, ?, ?, ?, ?, 0, 0)',
          [profileId, createdOn, updatedOn, systemUserId, systemUserId]
        );

        // Step 12: Insert into profile_interested_in_dating (required for profile page to load)
        console.log(`🔍 Row ${rowIndex}: Inserting profile_interested_in_dating...`);
        await connection.execute(
          'INSERT INTO profile_interested_in_dating (id, profile_id, interested_in_dating, created_on, updated_on, created_by, updated_by, deleted, version) VALUES (UUID(), ?, 1, ?, ?, ?, ?, 0, 0)',
          [profileId, createdOn, updatedOn, systemUserId, systemUserId]
        );

        // Step 13: Insert into profile_call_timing (required for profile page to load)
        console.log(`🔍 Row ${rowIndex}: Inserting profile_call_timing...`);
        await connection.execute(
          'INSERT INTO profile_pref_call_timing (id, profile_id, created_on, updated_on, created_by, updated_by, deleted, version) VALUES (UUID(), ?, ?, ?, ?, ?, 0, 0)',
          [profileId, createdOn, updatedOn, systemUserId, systemUserId]
        );

        // Step 14: Insert into profile_dates_timing (required for profile page to load)
        console.log(`🔍 Row ${rowIndex}: Inserting profile_dates_timing...`);
        await connection.execute(
          'INSERT INTO profile_pref_dates_timing (id, profile_id, created_on, updated_on, created_by, updated_by, deleted, version) VALUES (UUID(), ?, ?, ?, ?, ?, 0, 0)',
          [profileId, createdOn, updatedOn, systemUserId, systemUserId]
        );

        // Step 15: Update profile with profile_pref_id reference
        console.log(`🔍 Row ${rowIndex}: Getting profile_preferences ID to update profile...`);
        // const [prefResult] = await connection.execute(
        //   'SELECT id FROM profile_pref WHERE profile_id = ? ORDER BY created_on DESC LIMIT 1',
        //   [profileId]
        // );

        // if (prefResult && prefResult.length > 0) {
        //   const prefId = prefResult[0].id;
        //   await connection.execute(
        //     'UPDATE profile SET profile_pref_id = ? WHERE id = ?',
        //     [prefId, profileId]
        //   );
        //   console.log(`🔍 Row ${rowIndex}: Profile updated with profile_pref_id: ${prefId}`);
        // }
        
        // Mark this row as successfully processed
        insertionResults.successful.push({
          rowIndex,
          email,
          phone,
          message: 'Successfully inserted all records'
        });
        
        console.log(`✅ Row ${rowIndex}: Successfully processed all records`);
        
      } catch (rowError) {
        // Handle individual row errors without stopping the entire process
        console.error(`❌ Row ${rowIndex}: Error processing row:`, rowError.message);
        
        // Check if it's a duplicate entry error
        if (rowError.message.includes('Duplicate entry') || rowError.message.includes('UNIQUE constraint')) {
          insertionResults.skipped.push({
            rowIndex,
            email: values[columnMapping.email]?.formattedValue || '',
            phone: values[columnMapping.phone]?.formattedValue || '',
            reason: 'Duplicate entry - already exists in database',
            error: rowError.message
          });
          console.log(`⚠️ Row ${rowIndex}: Skipped duplicate entry`);
        } else {
          insertionResults.failed.push({
            rowIndex,
            email: values[columnMapping.email]?.formattedValue || '',
            phone: values[columnMapping.phone]?.formattedValue || '',
            reason: 'Processing error',
            error: rowError.message
          });
          console.log(`❌ Row ${rowIndex}: Failed to process - will continue with next row`);
        }
        
        // Continue with next row instead of stopping
        continue;
      }
    }
    
    // Commit transaction if we have any successful insertions
    if (insertionResults.successful.length > 0) {
      await connection.commit();
      console.log(`✅ Transaction committed successfully. ${insertionResults.successful.length} rows processed successfully.`);
    } else {
      // If no rows were successful, rollback
      await connection.rollback();
      console.log(`⚠️ No rows were successful. Transaction rolled back.`);
    }
      
    } catch (error) {
      // Rollback on error
      await connection.rollback();
      throw error;
    } finally {
      await connection.end();
    }

    // Simulate 4-table insertion (replace with real logic)
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate insertion time

    // Log the data structure for debugging
    console.log('Sample row data structure:', selectedRows[0]);
    console.log('Column mapping:', columnMapping);

    return NextResponse.json({
      success: true,
      message: `Processed ${selectedRows.length} rows with detailed results`,
      totalRows: selectedRows.length,
      successfulRows: insertionResults.successful.length,
      failedRows: insertionResults.failed.length,
      skippedRows: insertionResults.skipped.length,
      insertionResults: {
        successful: insertionResults.successful,
        failed: insertionResults.failed,
        skipped: insertionResults.skipped
      },
      spreadsheetId,
      worksheetName,
      tablesInserted: ['profile', 'profile_email', 'profile_phone', 'hit', 'followup', 'profile_product_lead', 'post_it'],
      newFields: ['birthdate', 'age', 'job_text', 'registration_date', 'post_it_comment'],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Data insertion failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Data insertion failed', 
        message: error.message || 'Unknown error occurred during data insertion',
        suggestion: 'Please check your database connection and try again.'
      },
      { status: 500 }
    );
  }
}
