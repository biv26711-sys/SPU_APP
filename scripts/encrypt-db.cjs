const Database = require('better-sqlite3-multiple-ciphers');
const path = require('path');
const fs = require('fs');

const plainPath = path.join(__dirname, '..', 'db', 'db2_final.db');
const encryptedPath = path.join(__dirname, '..', 'db', 'db2_final_encrypted.db');

const dbKey = 'my-super-secret-key-2026';

if (!fs.existsSync(plainPath)) {
  throw new Error(`Не найден исходный файл: ${plainPath}`);
}

if (fs.existsSync(encryptedPath)) {
  fs.unlinkSync(encryptedPath);
}

const db = new Database(plainPath);

db.exec(`
  ATTACH DATABASE '${encryptedPath.replace(/\\/g, "\\\\")}' AS encrypted KEY '${dbKey}';
`);

db.exec(`
  SELECT sqlcipher_export('encrypted');
`);

db.exec(`
  DETACH DATABASE encrypted;
`);

db.close();

console.log('Готово: создан зашифрованный файл', encryptedPath);