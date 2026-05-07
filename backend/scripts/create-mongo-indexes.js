/**
 * Creates MongoDB indexes for optimal query performance.
 * Safe to re-run — createIndex is idempotent.
 * Usage: node scripts/create-mongo-indexes.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const { MONGO_URI } = process.env;
if (!MONGO_URI) throw new Error('MONGO_URI environment variable is required');

async function run() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  // messages — text search on content + fast lookup by conversationId
  await db.collection('messages').createIndex({ content: 'text' }, { name: 'messages_content_text' });
  await db.collection('messages').createIndex({ conversationId: 1, created_at: 1 }, { name: 'messages_conv_date' });
  await db.collection('messages').createIndex({ conversationId: 1, role: 1 }, { name: 'messages_conv_role' });

  // conversations — fast lookup by userId + date
  await db.collection('conversations').createIndex({ userId: 1, is_deleted: 1, last_message_at: -1 }, { name: 'convs_user_date' });

  // symptomchecks — fast lookup by userId
  await db.collection('symptomchecks').createIndex({ userId: 1, createdAt: -1 }, { name: 'symptomchecks_user_date' });

  // chats (legacy) — fast lookup by userId
  await db.collection('chats').createIndex({ userId: 1, createdAt: -1 }, { name: 'chats_user_date' });

  console.log('All MongoDB indexes created successfully.');
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
