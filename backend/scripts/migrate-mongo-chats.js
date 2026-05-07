/**
 * One-time migration: converts existing `chats` documents into
 * `conversations` + `messages` collections.
 *
 * Idempotent — skips any chat whose _id already exists as a conversation source.
 * Run: node scripts/migrate-mongo-chats.js
 */
require('dotenv').config();
const mongoose   = require('mongoose');
const Chat       = require('../src/models/Chat');
const Conversation = require('../src/models/Conversation');
const Message    = require('../src/models/Message');

const { MONGO_URI } = process.env;
if (!MONGO_URI) throw new Error('MONGO_URI environment variable is required');

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const chats = await Chat.find({}).sort({ createdAt: 1 }).lean();
  console.log(`Found ${chats.length} chat document(s) to migrate`);

  let created = 0;
  let skipped = 0;

  for (const chat of chats) {
    // Use chat._id as a stable idempotency key stored in conversation summary field
    const exists = await Conversation.findOne({ summary: `migrated:${chat._id}` });
    if (exists) { skipped++; continue; }

    const conv = await Conversation.create({
      userId:          chat.userId,
      title:           chat.question
        ? (chat.question.length <= 60 ? chat.question : `${chat.question.slice(0, 57)}…`)
        : 'Migrated conversation',
      language:        chat.language || 'en',
      is_deleted:      false,
      message_count:   2,
      total_tokens:    0,
      summary:         `migrated:${chat._id}`,
      last_message_at: chat.createdAt || new Date(),
      created_at:      chat.createdAt || new Date(),
    });

    await Message.insertMany([
      {
        conversationId: conv._id,
        role:           'user',
        content:        chat.question || '',
        created_at:     chat.createdAt || new Date(),
      },
      {
        conversationId:    conv._id,
        role:              'assistant',
        content:           buildTextContent(chat.aiResponse),
        structured_output: chat.aiResponse || null,
        prompt_version:    chat.aiResponse?.promptVersion || '',
        created_at:        chat.updatedAt || chat.createdAt || new Date(),
      },
    ]);

    created++;
  }

  console.log(`\nMigration complete.`);
  console.log(`  Created : ${created} conversation(s)`);
  console.log(`  Skipped : ${skipped} (already migrated)`);
  await mongoose.disconnect();
}

function buildTextContent(aiResponse) {
  if (!aiResponse) return '';
  const parts = [];
  if (aiResponse.symptoms?.length)           parts.push(`Symptoms: ${aiResponse.symptoms.join(', ')}`);
  if (aiResponse.possibleCauses?.length)     parts.push(`Possible causes: ${aiResponse.possibleCauses.join(', ')}`);
  if (aiResponse.prevention?.length)         parts.push(`Prevention: ${aiResponse.prevention.join(', ')}`);
  if (aiResponse.whenToConsultDoctor?.length) parts.push(`When to consult: ${aiResponse.whenToConsultDoctor.join(', ')}`);
  if (aiResponse.riskLevel)                  parts.push(`Risk level: ${aiResponse.riskLevel}`);
  if (aiResponse.disclaimer)                 parts.push(aiResponse.disclaimer);
  return parts.join('\n\n');
}

run().catch((err) => { console.error(err); process.exit(1); });
