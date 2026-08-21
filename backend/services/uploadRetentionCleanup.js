const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const BookingCompanion = require("../models/BookingCompanion");
const { deleteFile: deleteGridFsFile, getFileInfo } = require("./gridfsStorage");
const { cleanupExpiredMessageAttachments } = require("./messageAttachmentCleanup");

const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
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
  const bookings = await Booking.find({}).select(
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
    return { skipped: true, ttlHours: 24 };
  }
  if (cleanupPromise) return cleanupPromise;

  cleanupPromise = (async () => {
    try {
      const cutoffMs = now - UPLOAD_TTL_MS;
      const messageResult = await cleanupExpiredMessageAttachments(force);
      const bookingResult = await cleanupBookingUploads(cutoffMs);
      const companionIdsCleared = await cleanupCompanionIds(cutoffMs);
      const oldGridFsFilesDeleted = await cleanupKnownOrphanGridFsFiles(cutoffMs);

      lastCleanupAt = Date.now();
      const result = {
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
      return { skipped: false, ttlHours: 24, error: err.message };
    } finally {
      cleanupPromise = null;
    }
  })();

  return cleanupPromise;
}

module.exports = {
  cleanupExpiredTransientUploads,
  UPLOAD_TTL_MS
};
