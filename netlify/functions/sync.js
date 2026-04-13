const { exec } = require('child_process');
const { ok, err, json, requireAuth, checkRate, safeErr } = require('./shared/db');

// Only available in local development
const isLocal = process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, '');
  if (!checkRate(event)) return err(429, 'Te veel verzoeken');
  if (!isLocal) return err(403, 'Alleen beschikbaar in lokale ontwikkelmodus');

  try {
    await requireAuth(event);

    if (event.httpMethod !== 'POST') return err(405, 'Method not allowed');

    const output = await new Promise((resolve, reject) => {
      exec('git pull origin main', { cwd: process.cwd(), timeout: 30000 }, (error, stdout, stderr) => {
        if (error) return reject(new Error(stderr || error.message));
        resolve(stdout.trim());
      });
    });

    const upToDate = output.includes('Already up to date') || output.includes('Already up-to-date');
    return ok({ message: output, upToDate });

  } catch (e) {
    return safeErr(e);
  }
};
