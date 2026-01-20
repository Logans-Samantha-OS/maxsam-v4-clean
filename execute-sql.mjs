import { readFileSync } from 'fs';

const projectRef = 'tidcqvhxdsbnfykbvygs';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpZGNxdmh4ZHNibmZ5a2J2eWdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk3NzEzOSwiZXhwIjoyMDc4NTUzMTM5fQ.gZs_O-mQX_c3E_0kKXToUWuQX9OCxNGzz_-XrhW6LVw';

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('Usage: node execute-sql.mjs <sql-file>');
  process.exit(1);
}

console.log('Reading:', sqlFile);
const sql = readFileSync(sqlFile, 'utf8');
console.log('SQL length:', sql.length, 'characters');

// Use Supabase pg-meta API for SQL execution
const pgMetaUrl = `https://${projectRef}.supabase.co/pg`;

async function executeSql() {
  // Try the pg-meta query endpoint
  const response = await fetch(`${pgMetaUrl}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ query: sql })
  });

  console.log('Response status:', response.status);

  if (response.ok) {
    const result = await response.json();
    console.log('Success!');
    console.log('Result:', JSON.stringify(result, null, 2).substring(0, 500));
    return true;
  } else {
    const text = await response.text();
    console.log('pg-meta response:', text.substring(0, 200));

    // Try alternative: use the REST RPC if we have a function
    console.log('\nTrying alternative methods...');

    // Try the SQL API endpoint
    const sqlApiResponse = await fetch(`https://${projectRef}.supabase.co/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ sql_text: sql })
    });

    if (sqlApiResponse.ok) {
      console.log('exec_sql RPC succeeded!');
      return true;
    }

    console.log('exec_sql RPC status:', sqlApiResponse.status);
    console.log('exec_sql response:', await sqlApiResponse.text());

    return false;
  }
}

const success = await executeSql();
if (!success) {
  console.log('\n==========================================');
  console.log('Direct SQL execution not available via API.');
  console.log('Please paste the SQL into Supabase SQL Editor:');
  console.log(`https://supabase.com/dashboard/project/${projectRef}/sql/new`);
  console.log('==========================================');
}
