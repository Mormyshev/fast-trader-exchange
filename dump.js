const { Client } = require('pg');
const fs = require('fs');

function pgHost(value) {
  let raw = String(value || "").trim();
  raw = raw.replace(/^https?:/i, "");
  raw = raw.replace(/^\/\//, "");
  return raw.split("/")[0].split(":")[0];
}

const client = new Client({
    user: 'postgres.bjdmkslrvujlrbqsvgmu',
    host: pgHost('aws-0-eu-west-1.pooler.supabase.com'),
    database: 'postgres',
    password: 'Karakum812',
    port: 5432,
    ssl: { rejectUnauthorized: false }
  });
  

async function runDump() {
  try {
    await client.connect();
    console.log("Успешное прямое подключение к Supabase...");

    const query = `
      SELECT 
        'CREATE TABLE public.' || table_name || ' (' || 
        string_agg(column_name || ' ' || data_type || 
          CASE 
            WHEN character_maximum_length IS NOT NULL THEN '(' || character_maximum_length || ')'
            ELSE ''
          END || 
          CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END, ', ') || ');' AS ddl
      FROM information_schema.columns
      WHERE table_schema = 'public'
      GROUP BY table_name;
    `;

    const res = await client.query(query);
    const sqlDump = res.rows.map(row => row.ddl).join('\n\n');

    fs.writeFileSync('cloud_structure.sql', sqlDump);
    console.log("🎉 Файл cloud_structure.sql успешно создан в папке проекта!");

  } catch (err) {
    console.error("Ошибка при выполнении дампа:", err.message);
  } finally {
    await client.end();
  }
}

runDump();
