const Message = require('../models/Message');
const { deleteFile: deleteGridFsFile } = require('./gridfsStorage');

const ATTACHMENT_TTL_MS = 24 * 60 * 60 * 1000;
let lastCleanupAt = 0;
let cleanupPromise = null;

async function cleanupExpiredMessageAttachments(force = false) {
  const now = Date.now();
  if (!force && now - lastCleanupAt < 10 * 60 * 1000) return { scanned: 0, cleared: 0 };
  if (cleanupPromise) return cleanupPromise;

  cleanupPromise = (async () => {
    let scanned = 0;
    let cleared = 0;
    try {
      const cutoff = new Date(now - ATTACHMENT_TTL_MS);
      const messages = await Message.find({
        createdAt: { $lte: cutoff },
        'attachments.0': { $exists: true }
      }).select('_id attachments').lean();
      scanned = messages.length;

      for (const message of messages) {
        for (const attachment of message.attachments || []) {
          if (attachment.fileId) {
            try {
              await deleteGridFsFile(String(attachment.fileId));
            } catch (err) {
              console.error(`MESSAGE ATTACHMENT DELETE ERROR (${attachment.fileId}):`, err.message);
            }
          }
        }
        await Message.updateOne({ _id: message._id }, { $set: { attachments: [] } });
        cleared += 1;
      }

      lastCleanupAt = Date.now();
      if (cleared) console.log(`🧹 Message attachment cleanup: cleared ${cleared} message attachment set(s) older than 24 hours.`);
      return { scanned, cleared };
    } catch (err) {
      console.error('MESSAGE ATTACHMENT CLEANUP ERROR:', err);
      return { scanned, cleared, error: err.message };
    } finally {
      cleanupPromise = null;
    }
  })();

  return cleanupPromise;
}

module.exports = { cleanupExpiredMessageAttachments, ATTACHMENT_TTL_MS };
