const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversationId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    role:             { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content:          { type: String, required: true },
    structured_output:{ type: mongoose.Schema.Types.Mixed, default: null }, // full AI JSON response
    citations:        [{ source: String, url: String, snippet: String }],
    tokens_in:        { type: Number, default: 0 },
    tokens_out:       { type: Number, default: 0 },
    model:            { type: String, default: '' },
    prompt_version:   { type: String, default: '' },
    latency_ms:       { type: Number, default: 0 },
    parent_message_id:{ type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
);

messageSchema.index({ conversationId: 1, created_at: 1 });

module.exports = mongoose.model('Message', messageSchema);
