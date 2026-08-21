const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const BookingCompanion = require("../models/BookingCompanion");
const { deleteFile: deleteGridFsFile, getFileInfo } = require("./gridfsStorage");
const { cleanupExpiredMessageAttachments } = require("./messageAttachmentCleanup");

const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const CLEANUP_LOCK_MS = 5 * 60 * 1000;
const LOCK_ID = "transient-upload-retention";
let lastCleanupAt = 0;
let cleanupPromise = null;

function asTime(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isObjectIdString(value) {
  return /^[a-f0-9]{24}$/i.test(String(value || "").trim());
}

async function claimCleanupLease(force = false) {
  if (!mongoose.connection.db) return false;
  const collection = mongoose.connection.db.collection("maintenance_locks");
  const now = new Date();
  const epoch = new Date(0);

  await collection.updateOne(
    { _id: LOCK_ID },
    { $setOnInsert: { nextRunAt: epoch, lockedUntil: epoch, createdAt: now } },
    { upsert: true }
  );

  const filter = { _id: LOCK_ID, lockedUntil: { $lte: now } };
  if (!force) filter.nextRunAt = { $lte: now };

  const claimed = await collection.findOneAndUpdate(
    filter,
    {
      $set: {
        lockedUntil: new Date(now.getTime() + CLEANUP_LOCK_MS),
        nextRunAt: new Date(now.getTime() + CLEANUP_INTERVAL_MS),
        startedAt: now
      }
    },
    { returnDocument: "after" }
  );

  return Boolean(claimed);
}

async function releaseCleanupLease(result = {}) {
  if (!mongoose.connection.db) return;
  try {
    await mongoose.connection.db.collection("maintenance_locks").updateOne(
      { _id: LOCK_ID },
      {
        $set: {
          lockedUntil: new Date(0),
          finishedAt: new Date(),
          lastResult: {
            ttlHours: 24,
            messageAttachmentSetsCleared: Number(result.messageAttachmentSetsCleared || 0),
            bookingsChanged: Number(result.bookingsChanged || 0),
            bookingFilesCleared: Number(result.bookingFilesCleared || 0),
            companionIdsCleared: Number(result.companionIdsCleared || 0),
            oldGridFsFilesDeleted: Number(result.oldGridFsFilesDeleted || 0),
            error: String(result.error || "").slice(0, 500)
          }
        }
      }
    );
  } catch (err) {
    console.error("UPLOAD CLEANUP LEASE RELEASE ERROR:", err.message);
  }
}

async function storedValueExpired(value, preferredTimestamp, fallbackTimestamp, cutoffMs) {
  if (!value) return false;
  const preferred = asTime(preferredTimestamp);
  if (preferred) return preferred <= cutoffMs;

  if (isObjectIdString(value)) {
    try {
      const info = await getFileInfo(String(value).trim());
      const uploadedAt = asTime(info?.metadata?.uploadedAt || info?.uploadDate);
      if (uploadedAt) return uploadedAt <= cutoffMs;
    } catch (_) {}
  }

  const fallback = asTime(fallbackTimestamp);
  return Boolean(fallback && fallback <= cutoffMs);
}

async function deleteStoredValue(value) {
  if (!value || !isObjectIdString(value)) return;
  try {
    await deleteGridFsFile(String(value).trim());
  } catch (err) {
    console.error(`24H UPLOAD DELETE ERROR (${value}):`, err.message);
  }
}

async function cleanupBookingUploads(cutoffMs) {
  const present = { $nin: [null, ""] };
  const bookings = await Booking.find({
    $or: [
      { paymentProof: present },
      { governmentId: present },
      { driversLicense: present },
      { reschedulePaymentProof: present },
      { "extraRequests.paymentProof": present }
    ]
  }).select(
    "_id createdAt updatedAt paymentProof paymentDate paymentProofSubmittedAt governmentId driversLicense reschedulePaymentProof reschedulePaymentSubmittedAt extraRequests"
  ).lean();

  let bookingsChanged = 0;
  let bookingFilesCleared = 0;

  for (const booking of bookings) {
    const set = {};
    let changed = false;

    if (booking.paymentProof && await storedValueExpired(
      booking.paymentProof,
      booking.paymentProofSubmittedAt || booking.paymentDate,
      booking.updatedAt || booking.createdAt,
      cutoffMs
    )) {
      await deleteStoredValue(booking.paymentProof);
      set.paymentProof = "";
      changed = true;
      bookingFilesCleared += 1;
    }

    if (booking.governmentId && await storedValueExpired(
      booking.governmentId,
      null,
      booking.updatedAt || booking.createdAt,
      cutoffMs
    )) {
      await deleteStoredValue(booking.governmentId);
      set.governmentId = "";
      changed = true;
      bookingFilesCleared += 1;
    }

    if (booking.driversLicense && await storedValueExpired(
      booking.driversLicense,
      null,
      booking.updatedAt || booking.createdAt,
      cutoffMs
    )) {
      await deleteStoredValue(booking.driversLicense);
      set.driversLicense = "";
      changed = true;
      bookingFilesCleared += 1;
    }

    if (booking.reschedulePaymentProof && await storedValueExpired(
      booking.reschedulePaymentProof,
      booking.reschedulePaymentSubmittedAt,
      booking.updatedAt || booking.createdAt,
      cutoffMs
    )) {
      await deleteStoredValue(booking.reschedulePaymentProof);
      set.reschedulePaymentProof = "";
      changed = true;
      bookingFilesCleared += 1;
    }

    if (Array.isArray(booking.extraRequests) && booking.extraRequests.length) {
      let extraChanged = false;
      const extraRequests = [];
      for (const request of booking.extraRequests) {
        const next = { ...request };
        if (request?.paymentProof && await storedValueExpired(
          request.paymentProof,
          request.paymentSubmittedAt || request.requestedAt,
          booking.updatedAt || booking.createdAt,
          cutoffMs
        )) {
          await deleteStoredValue(request.paymentProof);
          next.paymentProof = "";
          next.paymentProofFileName = "";
          extraChanged = true;
          bookingFilesCleared += 1;
        }
        extraRequests.push(next);
      }
      if (extraChanged) {
        set.extraRequests = extraRequests;
        changed = true;
      }
    }

    if (changed) {
      await Booking.updateOne({ _id: booking._id }, { $set: set });
      bookingsChanged += 1;
    }
  }

  return { bookingsChanged, bookingFilesCleared };
}

async function cleanupCompanionIds(cutoffMs) {
  const cutoff = new Date(cutoffMs);
  const companions = await BookingCompanion.find({
    idFile: { $nin: [null, ""] },
    $or: [
      { submittedAt: { $lte: cutoff } },
      { submittedAt: null, createdAt: { $lte: cutoff } }
    ]
  }).select("_id idFile").lean();

  for (const companion of companions) {
    await deleteStoredValue(companion.idFile);
    await BookingCompanion.updateOne(
      { _id: companion._id },
      { $set: { idFile: "", idFileName: "" } }
    );
  }

  return companions.length;
}

async function cleanupKnownOrphanGridFsFiles(cutoffMs) {
  if (!mongoose.connection.db) return 0;
  const cutoff = new Date(cutoffMs);
  const files = await mongoose.connection.db.collection("uploads.files").find({
    uploadDate: { $lte: cutoff },
    filename: {
      $regex: /(?:-payment-\d+|-(?:governmentId|driversLicense|reschedulePaymentProof)-\d+|-companion-\d+-\d+)/i
    }
  }).project({ _id: 1 }).toArray();

  for (const file of files) {
    await deleteStoredValue(String(file._id));
  }
  return files.length;
}

async function cleanupExpiredTransientUploads(force = false) {
  const now = Date.now();
  if (!force && now - lastCleanupAt < CLEANUP_INTERVAL_MS) {
    return { skipped: true, reason: "local-throttle", ttlHours: 24 };
  }
  if (cleanupPromise) return cleanupPromise;

  cleanupPromise = (async () => {
    let leaseClaimed = false;
    let result = { skipped: true, ttlHours: 24 };
    try {
      leaseClaimed = await claimCleanupLease(force);
      if (!leaseClaimed) {
        lastCleanupAt = Date.now();
        return { skipped: true, reason: "shared-throttle", ttlHours: 24 };
      }

      const cutoffMs = now - UPLOAD_TTL_MS;
      const messageResult = await cleanupExpiredMessageAttachments(force);
      const bookingResult = await cleanupBookingUploads(cutoffMs);
      const companionIdsCleared = await cleanupCompanionIds(cutoffMs);
      const oldGridFsFilesDeleted = await cleanupKnownOrphanGridFsFiles(cutoffMs);

      lastCleanupAt = Date.now();
      result = {
        skipped: false,
        ttlHours: 24,
        messageAttachmentSetsCleared: Number(messageResult?.cleared || 0),
        bookingsChanged: bookingResult.bookingsChanged,
        bookingFilesCleared: bookingResult.bookingFilesCleared,
        companionIdsCleared,
        oldGridFsFilesDeleted
      };

      const total = result.messageAttachmentSetsCleared + result.bookingFilesCleared + result.companionIdsCleared + result.oldGridFsFilesDeleted;
      if (total) console.log(`🧹 24-hour upload retention cleanup removed/cleared ${total} transient upload item(s).`);
      return result;
    } catch (err) {
      console.error("24-HOUR UPLOAD RETENTION CLEANUP ERROR:", err);
      result = { skipped: false, ttlHours: 24, error: err.message };
      return result;
    } finally {
      if (leaseClaimed) await releaseCleanupLease(result);
      cleanupPromise = null;
    }
  })();

  return cleanupPromise;
}

module.exports = {
  cleanupExpiredTransientUploads,
  UPLOAD_TTL_MS
};
