import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // TiDB doesn't support DEFAULT ('[]') for json - use CAST or just leave no default
  await conn.query(`CREATE TABLE IF NOT EXISTS people (
    id int AUTO_INCREMENT NOT NULL,
    userId int NOT NULL,
    fullName varchar(255) NOT NULL,
    firstName varchar(128),
    lastName varchar(128),
    title varchar(255),
    company varchar(255),
    location varchar(255),
    linkedinUrl text,
    websiteUrl text,
    email varchar(320),
    phone varchar(32),
    sourceType varchar(64),
    sourceUrl text,
    aiSummary text,
    tags json,
    status varchar(32) DEFAULT 'saved',
    relevanceScore decimal(5,2),
    lastInteractionAt timestamp NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT people_id PRIMARY KEY(id)
  )`);
  console.log('people created');

  await conn.query(`CREATE TABLE IF NOT EXISTS user_goals (
    id int AUTO_INCREMENT NOT NULL,
    userId int NOT NULL,
    primaryGoal varchar(128),
    industries json,
    geographies json,
    preferences json,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT user_goals_id PRIMARY KEY(id)
  )`);
  console.log('user_goals created');

  await conn.query(`CREATE TABLE IF NOT EXISTS voice_captures (
    id int AUTO_INCREMENT NOT NULL,
    userId int NOT NULL,
    audioUrl text,
    transcript text NOT NULL,
    parsedJson json,
    status varchar(32) DEFAULT 'parsed',
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT voice_captures_id PRIMARY KEY(id)
  )`);
  console.log('voice_captures created');

  // Create indexes (ignore errors for already existing)
  const indexes = [
    'CREATE INDEX idx_people_userId ON people (userId)',
    'CREATE INDEX idx_people_userId_fullName ON people (userId, fullName)',
    'CREATE INDEX idx_person_notes_personId ON person_notes (personId)',
    'CREATE INDEX idx_search_queries_userId ON search_queries (userId)',
    'CREATE INDEX idx_search_results_queryId ON search_results (searchQueryId)',
    'CREATE INDEX idx_tasks_userId_status_due ON tasks (userId, status, dueAt)',
    'CREATE INDEX idx_tasks_personId ON tasks (personId)',
    'CREATE INDEX idx_user_goals_userId ON user_goals (userId)',
    'CREATE INDEX idx_voice_captures_userId ON voice_captures (userId)',
    'CREATE INDEX idx_drafts_userId ON drafts (userId)',
    'CREATE INDEX idx_drafts_personId ON drafts (personId)',
    'CREATE INDEX idx_interactions_userId_occurred ON interactions (userId, occurredAt)',
    'CREATE INDEX idx_interactions_personId ON interactions (personId)',
    'CREATE INDEX idx_lists_userId ON lists (userId)',
    'CREATE INDEX idx_opportunities_userId_status ON opportunities (userId, status)',
    'CREATE INDEX idx_opportunities_personId ON opportunities (personId)',
    'CREATE INDEX idx_activity_log_userId ON activity_log (userId, createdAt)',
  ];

  for (const idx of indexes) {
    try { await conn.query(idx); } catch (e) { /* ignore duplicates */ }
  }
  console.log('indexes done');

  // Alter users table
  const alters = [
    "ALTER TABLE users ADD COLUMN avatarUrl text",
    "ALTER TABLE users ADD COLUMN timezone varchar(64) DEFAULT 'America/New_York'",
    "ALTER TABLE users ADD COLUMN language varchar(8) DEFAULT 'en'",
    "ALTER TABLE users ADD COLUMN dailyBriefEnabled int DEFAULT 1",
    "ALTER TABLE users ADD COLUMN reminderMode varchar(16) DEFAULT 'smart'",
    "ALTER TABLE users ADD COLUMN onboardingCompleted int DEFAULT 0",
  ];
  for (const alt of alters) {
    try { await conn.query(alt); } catch (e) { /* ignore if exists */ }
  }
  console.log('users altered');

  const [rows] = await conn.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME');
  console.log('Final tables:', rows.map(r => r.TABLE_NAME).join(', '));
  console.log('Count:', rows.length);

  await conn.end();
}

main().catch(console.error);
