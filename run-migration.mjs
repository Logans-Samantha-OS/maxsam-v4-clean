import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { createConnection } from 'net';

const supabaseUrl = 'https://tidcqvhxdsbnfykbvygs.supabase.co';
const supabaseKey = process.argv[3] || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('Usage: node run-migration.mjs <sql-file> <service-role-key>');
  process.exit(1);
}

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('Usage: node run-migration.mjs <sql-file> <service-role-key>');
  process.exit(1);
}

console.log('Reading SQL file:', sqlFile);
const sql = readFileSync(sqlFile, 'utf8');

// Use fetch to call the Supabase SQL API directly
const projectRef = 'tidcqvhxdsbnfykbvygs';
const sqlApiUrl = `https://${projectRef}.supabase.co/rest/v1/rpc/`;

// Since we can't execute raw SQL via REST, let's use the pg protocol
// Actually, let's use the Supabase Management API

const managementApiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

async function executeSQL() {
  console.log('Executing SQL via Supabase...');
  console.log('SQL length:', sql.length, 'characters');

  // Try using the database REST endpoint with service role
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ query: sql })
  });

  if (!response.ok) {
    const text = await response.text();
    console.log('RPC exec_sql not available:', text);
    console.log('\n========================================');
    console.log('Direct SQL execution requires psql or Supabase CLI.');
    console.log('Please run the following in Supabase SQL Editor:');
    console.log('https://supabase.com/dashboard/project/tidcqvhxdsbnfykbvygs/sql/new');
    console.log('========================================\n');
    console.log('Or install Supabase CLI: npm install -g supabase');
    console.log('Then run: supabase db push');
    return false;
  }

  console.log('SQL executed successfully!');
  return true;
}

executeSQL().catch(console.error);
