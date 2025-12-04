require('dotenv').config();

const { exec } = require('child_process');

const dbs = ['output', 'payments', 'main'];

// Run command
function runCommand(cmd, contextLabel) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.error(`[${contextLabel}] Error executing: ${cmd}`);
        console.error(`[${contextLabel}] ${err.message}`);
        if (stderr) console.error(`[${contextLabel}] STDERR: ${stderr}`);
        return reject(err);
      }

      console.log(`[${contextLabel}] Success:\n${stdout}`);
      if (stderr) console.warn(`[${contextLabel}] Warning:\n${stderr}`);
      resolve();
    });
  });
}

// Run migration command
function runMigration(db) {
  const env = db;
  const migrationsPath = `dist/migrations/${db}`;
  const cmd = `npx sequelize db:migrate --env ${env} --migrations-path ${migrationsPath}`;
  return runCommand(cmd, db);
}

// Migrate all databases
exports.migrate = async () => {
  for (const db of dbs) {
    try {
      await runMigration(db);
    } catch (err) {
      console.error(`Migration failed for DB: ${db}`);
      process.exit(1);
    }
  }
};

// Migrate single DB
exports.migrateSingle = async (db) => {
  if (!dbs.includes(db)) {
    console.error(`Invalid DB name: ${db}`);
    process.exit(1);
  }

  try {
    await runMigration(db);
  } catch (err) {
    console.error(`Migration failed for DB: ${db}`);
    process.exit(1);
  }
};

// Rollback all databases
exports.migrateRollback = async () => {
  for (const db of dbs) {
    const cmd = `npx sequelize db:migrate:undo --env ${db} --migrations-path dist/migrations/${db}`;
    try {
      await runCommand(cmd, `rollback:${db}`);
    } catch (err) {
      console.error(`Rollback failed for DB: ${db}`);
      process.exit(1);
    }
  }
};

// Rollback single DB
exports.migrateRollbackSingle = async (db) => {
  if (!dbs.includes(db)) {
    console.error(`Invalid DB name for rollback: ${db}`);
    process.exit(1);
  }

  const cmd = `npx sequelize db:migrate:undo --env ${db} --migrations-path dist/migrations/${db}`;
  try {
    await runCommand(cmd, `rollback:${db}`);
  } catch (err) {
    console.error(`Rollback failed for DB: ${db}`);
    process.exit(1);
  }
};

// Reset all databases
exports.migrateReset = async () => {
  for (const db of dbs) {
    const cmd = `npx sequelize db:migrate:undo:all --env ${db} --migrations-path dist/migrations/${db}`;
    try {
      await runCommand(cmd, `reset:${db}`);
    } catch (err) {
      console.error(`Reset failed for DB: ${db}`);
      process.exit(1);
    }
  }
};

// Reset single DB
exports.migrateResetSingle = async (db) => {
  if (!dbs.includes(db)) {
    console.error(`Invalid DB name for reset: ${db}`);
    process.exit(1);
  }

  const cmd = `npx sequelize db:migrate:undo:all --env ${db} --migrations-path dist/migrations/${db}`;
  try {
    await runCommand(cmd, `reset:${db}`);
  } catch (err) {
    console.error(`Reset failed for DB: ${db}`);
    process.exit(1);
  }
};
