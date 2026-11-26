const transactionQueues = new WeakMap();
function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) reject(error);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}
function get(db, sql, params = []) {
  return new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
}
function all(db, sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}
function transaction(db, callback) {
  const previous = transactionQueues.get(db) || Promise.resolve();
  const current = previous.catch(() => {}).then(async () => {
    await run(db, "BEGIN IMMEDIATE");
    try {
      const value = await callback();
      await run(db, "COMMIT");
      return value;
    } catch (error) {
      await run(db, "ROLLBACK").catch(() => {});
      throw error;
    }
  });
  transactionQueues.set(db, current.catch(() => {}));
  return current;
}
module.exports = { run, get, all, transaction };
