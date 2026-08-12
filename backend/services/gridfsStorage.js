const mongoose = require("mongoose");
const { GridFSBucket, ObjectId } = require("mongodb");

function bucket() {
  if (!mongoose.connection.db) throw new Error("MongoDB connection is not ready.");
  return new GridFSBucket(mongoose.connection.db, { bucketName: "uploads" });
}

function saveBuffer(buffer, filename, contentType) {
  return new Promise((resolve, reject) => {
    const uploadStream = bucket().openUploadStream(filename, {
      contentType: contentType || "application/octet-stream",
      metadata: { uploadedAt: new Date() }
    });
    uploadStream.on("error", reject);
    uploadStream.on("finish", () => resolve(String(uploadStream.id)));
    uploadStream.end(buffer);
  });
}

function openDownload(id) {
  let objectId;
  try { objectId = new ObjectId(String(id)); } catch (_) { return null; }
  return bucket().openDownloadStream(objectId);
}

async function deleteFile(id) {
  try {
    const objectId = new ObjectId(String(id));
    await bucket().delete(objectId);
  } catch (_) {}
}

module.exports = { saveBuffer, openDownload, deleteFile };
