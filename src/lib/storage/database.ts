import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

function ensureColumn(
  database: Database.Database,
  table: string,
  column: string,
  definition: string,
) {
  const columns = database
    .prepare(`PRAGMA table_info(${table})`)
    .all() as Array<{ name: string }>;

  if (!columns.some((entry) => entry.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function createDatabase(runtimeDir: string): Database.Database {
  mkdirSync(runtimeDir, { recursive: true });
  const databasePath = path.join(runtimeDir, "memduck.sqlite");
  const database = new Database(databasePath);

  database.pragma("journal_mode = WAL");

  database.exec(`
    CREATE TABLE IF NOT EXISTS source_items (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      source_channel TEXT NOT NULL,
      source_url TEXT,
      page_title TEXT,
      body_text TEXT,
      snapshot_path TEXT,
      object_key TEXT,
      mime_type TEXT,
      caption TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memory_cards (
      id TEXT PRIMARY KEY,
      source_item_id TEXT NOT NULL,
      source_channel TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      deep_summary TEXT NOT NULL,
      key_points_json TEXT NOT NULL,
      evidence_json TEXT NOT NULL,
      topic_ids_json TEXT NOT NULL,
      status TEXT NOT NULL,
      worth_saving INTEGER NOT NULL,
      sequence INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(source_item_id) REFERENCES source_items(id)
    );

    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      keywords_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS signals (
      id TEXT PRIMARY KEY,
      card_id TEXT,
      topic_id TEXT,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversation_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      citations_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id)
    );

    CREATE TABLE IF NOT EXISTS card_embeddings (
      card_id TEXT PRIMARY KEY,
      embedding_json TEXT NOT NULL,
      source_text TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(card_id) REFERENCES memory_cards(id)
    );
  `);

  ensureColumn(database, "source_items", "snapshot_path", "TEXT");

  return database;
}
