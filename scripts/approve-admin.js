require('dotenv').config();
const postgres = require('postgres');

const databaseUrl = process.env.DATABASE_URL;
const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

if (!databaseUrl) {
  console.error('DATABASE_URL ontbreekt in .env');
  process.exit(1);
}
if (!adminEmail) {
  console.error('ADMIN_EMAIL ontbreekt in .env');
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

async function main() {
  const [admin] = await sql`
    UPDATE users
    SET approved = true
    WHERE lower(email) = ${adminEmail}
    RETURNING id, email, name
  `;
  if (!admin) throw new Error(`Geen geregistreerde gebruiker gevonden voor ${adminEmail}`);
  console.log(`Admin goedgekeurd: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
