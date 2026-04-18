import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

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
  `);

  return database;
}
