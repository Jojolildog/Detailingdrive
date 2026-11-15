import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
const migration = readFileSync(new URL('../../drizzle/0000_foundation.sql', import.meta.url), 'utf8');

// Exercise the real SQL repositories against SQLite, matching D1's prepared
// statement and atomic-batch semantics without a framework dependency.
export function createDatabase(filename = ':memory:', migrate = true) {
  const sqlite = new DatabaseSync(filename);
  sqlite.exec('PRAGMA foreign_keys = ON');
  if (migrate) sqlite.exec(migration);
  function prepare(sql, bindings = []) {
    return {
      bind(...values) { return prepare(sql, values); },
      async first(column) {
        const row = sqlite.prepare(sql).get(...bindings);
        return row ? (column ? row[column] : row) : null;
      },
      async all() { return { success: true, results: sqlite.prepare(sql).all(...bindings) }; },
      async run() { const result = sqlite.prepare(sql).run(...bindings); return { success: true, meta: { changes: Number(result.changes) } }; },
    };
  }
  return {
    sqlite, prepare,
    async batch(statements) {
      sqlite.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
    close() { sqlite.close(); },
  };
}
