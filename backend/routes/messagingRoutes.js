const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const GuestAccount = require("../models/GuestAccount");
const Booking = require("../models/Booking");
const Notification = require("../models/Notification");
const Message = require("../models/Message");

const sendEmail = require("../mail/sendEmail");
const { saveBuffer, openDownload, getFileInfo } = require("../services/gridfsStorage");
const { cleanupExpiredMessageAttachments } = require("../services/messageAttachmentCleanup");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "ca-smart-staycation-guest-secret";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || "casmartstaycation@gmail.com";
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "");
const ADMIN_JWT_SECRET =
  process.env.ADMIN_JWT_SECRET ||
  process.env.JWT_SECRET ||
  (ADMIN_PASSWORD
    ? crypto.createHash("sha256").update(`ca-smart-admin:${ADMIN_PASSWORD}`).digest("hex")
    : "");

function guestPayload(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) throw new Error("Authentication required.");
  return jwt.verify(header.slice(7), JWT_SECRET);
}

function adminPayload(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ") || !ADMIN_JWT_SECRET) {
    throw new Error("Admin authentication required.");
  }

  const payload = jwt.verify(header.slice(7), ADMIN_JWT_SECRET);
  if (
    payload.role !== "admin" ||
    String(payload.email || "").toLowerCase() !== String(ADMIN_EMAIL).toLowerCase()
  ) {
    throw new Error("Admin access required.");
  }

  return payload;
}

function normalizeAttachment(attachment) {
  if (!attachment || typeof attachment !== "object") return null;

  const name = String(attachment.name || "Attachment").trim().slice(0, 200);
  const data =
    typeof attachment.data === "string"
      ? attachment.data.trim()
      : typeof attachment.url === "string"
        ? attachment.url.trim()
        : "";

  let type = String(attachment.type || "").toLowerCase().trim();

  if (/^data:image\/(jpeg|jpg|png|webp|gif|bmp|svg\+xml);base64,/i.test(data)) {
    type = type || data.slice(5, data.indexOf(";"));
  }
  if (/^data:application\/pdf;base64,/i.test(data)) {
    type = type || "application/pdf";
  }
  if (type === "image/jpg") type = "image/jpeg";

  if (!type) {
    const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "";
    type =
      {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        gif: "image/gif",
        bmp: "image/bmp",
        svg: "image/svg+xml",
        pdf: "application/pdf",
      }[ext] || "";
  }

  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/bmp",
    "image/svg+xml",
    "application/pdf",
  ];

  if (!allowed.includes(type)) return null;
  if (
    !/^data:[^;]+;base64,/i.test(data) &&
    !/^https?:\/\//i.test(data) &&
    !data.startsWith("/")
  ) {
    return null;
  }
  if (data.length > 7 * 1024 * 1024) return null;

  return { name, type, data };
}

function getAttachments(body) {
  const raw = Array.isArray(body?.attachments) ? body.attachments : [];
  return raw.map(normalizeAttachment).filter(Boolean).slice(0, 3);
}

function attachmentBytes(list) {
  return list.reduce(
    (total, attachment) => total + Buffer.byteLength(String(attachment.data || ""), "utf8"),
    0
  );
}

async function persistAttachments(list) {
  const stored = [];

  for (const attachment of list) {
    if (/^data:[^;]+;base64,/i.test(attachment.data)) {
      const comma = attachment.data.indexOf(",");
      const encoded = comma >= 0 ? attachment.data.slice(comma + 1) : "";
      const buffer = Buffer.from(encoded, "base64");
      if (!buffer.length) continue;

      const fileId = await saveBuffer(buffer, attachment.name, attachment.type);
      stored.push({
        name: attachment.name,
        type: attachment.type,
        data: "",
        fileId,
      });
    } else if (attachment.data) {
      stored.push({
        name: attachment.name,
        type: attachment.type,
        data: attachment.data,
        fileId: "",
      });
    }
  }

  return stored;
}

function attachmentToken(messageId, guestEmail) {
  return jwt.sign(
    {
      scope: "message-attachment",
      messageId: String(messageId),
      guestEmail: String(guestEmail || "").toLowerCase(),
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
}

function publicMessage(message) {
  return {
    ...message,
    attachments: (message.attachments || []).map((attachment) => ({
      name: attachment.name,
      type: attachment.type,
      url: attachment.fileId
        ? `/api/messages/${message._id}/attachments/${encodeURIComponent(
            attachment.name
          )}?token=${encodeURIComponent(attachmentToken(message._id, message.guestEmail))}`
        : attachment.data || "",
    })),
  };
}

async function guestAccount(req) {
  const payload = guestPayload(req);
  const account = await GuestAccount.findById(payload.accountId).lean();
  if (!account) throw new Error("Account not found.");
  return account;
}

async function safeEmail(to, subject, html) {
  try {
    if (to) {
      await sendEmail(String(to).trim().toLowerCase(), subject, html);
    }
  } catch (error) {
    console.error(`MESSAGE ACTION EMAIL FAILED (${to}):`, error.message);
  }
}

async function syncCancellationNotifications(email) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const cancelled = await Booking.find({
    email: normalizedEmail,
    bookingStatus: "Cancelled",
    refundRequested: true,
  }).lean();

  for (const booking of cancelled) {
    const exists = await Notification.exists({
      recipientType: "guest",
      recipientEmail: normalizedEmail,
      booking: booking._id,
      type: "cancellation",
    });

    if (!exists) {
      await Notification.create({
        recipientType: "guest",
        recipientEmail: normalizedEmail,
        booking: booking._id,
        title: "Booking cancelled and refund requested",
        message: `Booking ${booking.bookingReference} was cancelled. Refund requested: ₱${Number(
          booking.refundAmount || 0
        ).toLocaleString()}. Refund status: ${booking.refundStatus || "Requested"}.`,
        type: "cancellation",
      });
    }
  }
}

async function syncAdminCancellationNotifications() {
  const cancelled = await Booking.find({
    bookingStatus: "Cancelled",
    refundRequested: true,
  }).lean();

  for (const booking of cancelled) {
    const exists = await Notification.exists({
      recipientType: "admin",
      booking: booking._id,
      type: "cancellation",
    });

    if (!exists) {
      await Notification.create({
        recipientType: "admin",
        booking: booking._id,
        title: "Booking cancellation — refund required",
        message: `${booking.bookingReference} was cancelled by the guest. Refund due: ₱${Number(
          booking.refundAmount || 0
        ).toLocaleString()}.`,
        type: "cancellation",
      });
    }
  }
}

router.get("/guest/inbox", async (req, res) => {
  try {
    const account = await guestAccount(req);
    await cleanupExpiredMessageAttachments();
    await syncCancellationNotifications(account.email);

    const [messages, notifications] = await Promise.all([
      Message.find({ guestEmail: account.email }).sort({ createdAt: 1 }).lean(),
      Notification.find({
        recipientType: "guest",
        recipientEmail: account.email,
      })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    res.json({
      success: true,
      messages: messages.map(publicMessage),
      notifications,
    });
  } catch (error) {
    res.status(401).json({ success: false, message: error.message });
  }
});

router.get("/admin/inbox", async (req, res) => {
  try {
    adminPayload(req);
    await cleanupExpiredMessageAttachments();
    await syncAdminCancellationNotifications();

    const [messages, notifications] = await Promise.all([
      Message.find().sort({ createdAt: 1 }).populate("booking").lean(),
      Notification.find({ recipientType: "admin" }).sort({ createdAt: -1 }).lean(),
    ]);

    res.json({
      success: true,
      messages: messages.map(publicMessage),
      notifications,
    });
  } catch (error) {
    res.status(401).json({ success: false, message: error.message });
  }
});

router.get("/messages/:messageId/attachments/:name", async (req, res) => {
  try {
    const queryToken = String(req.query.token || "");
    let tokenPayload = null;

    if (queryToken) {
      tokenPayload = jwt.verify(queryToken, JWT_SECRET);
      if (
        tokenPayload.scope !== "message-attachment" ||
        String(tokenPayload.messageId) !== String(req.params.messageId)
      ) {
        return res.status(403).json({
          success: false,
          message: "Attachment access denied.",
        });
      }
    } else {
      try {
        adminPayload(req);
      } catch (_) {
        const account = await guestAccount(req);
        const check = await Message.findById(req.params.messageId)
          .select("guestEmail")
          .lean();

        if (
          !check ||
          String(check.guestEmail).toLowerCase() !== String(account.email).toLowerCase()
        ) {
          return res.status(403).json({
            success: false,
            message: "Attachment access denied.",
          });
        }
      }
    }

    const message = await Message.findById(req.params.messageId).lean();
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found." });
    }

    if (
      message.createdAt &&
      new Date(message.createdAt).getTime() <= Date.now() - 24 * 60 * 60 * 1000
    ) {
      return res.status(404).json({ success: false, message: "Attachment expired." });
    }

    if (
      tokenPayload &&
      tokenPayload.guestEmail &&
      String(message.guestEmail).toLowerCase() !==
        String(tokenPayload.guestEmail).toLowerCase()
    ) {
      return res.status(403).json({
        success: false,
        message: "Attachment access denied.",
      });
    }

    const attachment = (message.attachments || []).find(
      (item) => String(item.name) === String(req.params.name)
    );

    if (!attachment) {
      return res.status(404).json({ success: false, message: "Attachment not found." });
    }

    if (!attachment.fileId) {
      if (!attachment.data) return res.status(404).end();

      const comma = attachment.data.indexOf(",");
      const encoded = comma >= 0 ? attachment.data.slice(comma + 1) : "";
      const buffer = Buffer.from(encoded, "base64");

      res.setHeader(
        "Content-Type",
        attachment.type || "application/octet-stream"
      );
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${String(attachment.name).replace(/"/g, "'")}"`
      );

      return res.end(buffer);
    }

    const info = await getFileInfo(attachment.fileId);
    if (!info) {
      return res.status(404).json({
        success: false,
        message: "Stored attachment not found.",
      });
    }

    res.setHeader(
      "Content-Type",
      info.contentType || attachment.type || "application/octet-stream"
    );
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${String(attachment.name).replace(/"/g, "'")}"`
    );

    const stream = openDownload(attachment.fileId);
    if (!stream) return res.status(404).end();

    stream.on("error", () => {
      if (!res.headersSent) res.status(404).end();
      else res.end();
    });

    stream.pipe(res);
  } catch (error) {
    console.error("MESSAGE ATTACHMENT ERROR", error);
    res.status(401).json({ success: false, message: error.message });
  }
});

router.put("/guest/inbox/read", async (req, res) => {
  try {
    const account = await guestAccount(req);

    await Promise.all([
      Message.updateMany(
        { guestEmail: account.email, readByGuest: false },
        { $set: { readByGuest: true } }
      ),
      Notification.updateMany(
        {
          recipientType: "guest",
          recipientEmail: account.email,
          read: false,
        },
        { $set: { read: true } }
      ),
    ]);

    res.json({ success: true });
  } catch (error) {
    res.status(401).json({ success: false, message: error.message });
  }
});

router.post("/guest/messages", async (req, res) => {
  try {
    const account = await guestAccount(req);
    const text = String(req.body.message || "").trim();
    const raw = getAttachments(req.body);

    if (!text && !raw.length) {
      return res.status(400).json({
        success: false,
        message: "Enter a message or attach a file.",
      });
    }

    if (attachmentBytes(raw) > 5.5 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        message: "The selected attachments are too large. Please use smaller photos.",
      });
    }

    const attachments = await persistAttachments(raw);
    if (raw.length && !attachments.length) {
      return res.status(400).json({
        success: false,
        message: "The selected attachment could not be stored.",
      });
    }

    let booking = null;
    if (req.body.bookingId) {
      booking = await Booking.findById(req.body.bookingId).lean();
      if (
        !booking ||
        String(booking.email).toLowerCase() !== String(account.email).toLowerCase()
      ) {
        return res.status(403).json({
          success: false,
          message: "Booking not found for this account.",
        });
      }
    }

    const message = await Message.create({
      guestEmail: account.email,
      booking: booking ? booking._id : null,
      senderType: "guest",
      senderName: String(account.email).split("@")[0],
      message: text,
      attachments,
      readByGuest: true,
      readByAdmin: false,
    });

    await Notification.create({
      recipientType: "admin",
      title: "New guest message",
      message: `${account.email} sent a new message${
        booking ? ` about ${booking.bookingReference}` : ""
      }.`,
      type: "message",
      booking: booking ? booking._id : null,
    });

    await safeEmail(
      ADMIN_EMAIL,
      `New Guest Message${booking ? ` — ${booking.bookingReference}` : ""}`,
      `<h2>CA Smart Staycation Admin Notification</h2><p><strong>Guest:</strong> ${
        account.email
      }</p><p><strong>Message:</strong></p><p>${String(
        text || "(Attachment only)"
      ).replace(
        /</g,
        "&lt;"
      )}</p><p>The guest message is available in the Admin Message Inbox.</p>`
    );

    res.status(201).json({
      success: true,
      data: publicMessage(message.toObject()),
    });
  } catch (error) {
    console.error("GUEST MESSAGE ERROR", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put("/admin/inbox/read", async (req, res) => {
  try {
    adminPayload(req);

    await Promise.all([
      Message.updateMany(
        { readByAdmin: false },
        { $set: { readByAdmin: true } }
      ),
      Notification.updateMany(
        { recipientType: "admin", read: false },
        { $set: { read: true } }
      ),
    ]);

    res.json({ success: true });
  } catch (error) {
    res.status(401).json({ success: false, message: error.message });
  }
});

router.post("/admin/messages", async (req, res) => {
  try {
    adminPayload(req);

    const email = String(req.body.guestEmail || "").trim().toLowerCase();
    const text = String(req.body.message || "").trim();
    const raw = getAttachments(req.body);

    if (!email || (!text && !raw.length)) {
      return res.status(400).json({
        success: false,
        message: "Guest email and message or attachment are required.",
      });
    }

    if (attachmentBytes(raw) > 5.5 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        message: "The selected attachments are too large. Please use smaller photos.",
      });
    }

    const attachments = await persistAttachments(raw);
    if (raw.length && !attachments.length) {
      return res.status(400).json({
        success: false,
        message: "The selected attachment could not be stored.",
      });
    }

    const booking = req.body.bookingId
      ? await Booking.findById(req.body.bookingId).lean()
      : null;

    const message = await Message.create({
      guestEmail: email,
      booking: booking ? booking._id : null,
      senderType: "admin",
      senderName: "CA Smart Staycation Admin",
      message: text,
      attachments,
      readByGuest: false,
      readByAdmin: true,
    });

    await Notification.create({
      recipientType: "guest",
      recipientEmail: email,
      title: "New message from CA Smart Staycation",
      message: (text || "Attachment").slice(0, 180),
      type: "message",
      booking: booking ? booking._id : null,
    });

    await safeEmail(
      email,
      `New message from CA Smart Staycation${
        booking ? ` — ${booking.bookingReference}` : ""
      }`,
      `<h2>CA Smart Staycation</h2><p>You have a new message from CA Smart Staycation.</p><p><strong>Message:</strong></p><p>${String(
        text || "(Attachment included)"
      ).replace(
        /</g,
        "&lt;"
      )}</p><p>Please log in to your Guest Account to view and reply.</p>`
    );

    res.status(201).json({
      success: true,
      data: publicMessage(message.toObject()),
    });
  } catch (error) {
    console.error("ADMIN MESSAGE ERROR", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/admin/bookings/:id/refund", async (req, res) => {
  try {
    adminPayload(req);

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found." });
    }

    if (!booking.refundRequested) {
      return res.status(409).json({
        success: false,
        message: "This booking has no refund request.",
      });
    }

    if (booking.refundStatus === "Refunded") {
      return res.status(409).json({
        success: false,
        message: "This refund has already been processed.",
      });
    }

    booking.refundStatus = "Refunded";
    booking.paymentStatus = "Refunded";
    booking.refundProcessedAt = new Date();
    booking.refundProcessedBy = ADMIN_EMAIL;
    await booking.save();

    const message = `Refund for booking ${
      booking.bookingReference
    } has been processed. Refund amount: ₱${Number(
      booking.refundAmount || 0
    ).toLocaleString()}.`;

    await Notification.create({
      recipientType: "guest",
      recipientEmail: booking.email,
      booking: booking._id,
      title: "Refund processed",
      message,
      type: "refund",
    });

    await Notification.create({
      recipientType: "admin",
      recipientEmail: ADMIN_EMAIL,
      booking: booking._id,
      title: `Refund processed — ${booking.bookingReference}`,
      message,
      type: "refund",
    });

    await safeEmail(
      booking.email,
      `Refund Processed — ${booking.bookingReference}`,
      `<h2>CA Smart Staycation</h2><p>${message}</p><p>Please log in to your Guest Account for the complete booking record.</p>`
    );

    res.json({
      success: true,
      message: "Refund marked as processed and notifications sent.",
      data: booking,
    });
  } catch (error) {
    console.error("ADMIN REFUND ERROR", error);
    res.status(401).json({ success: false, message: error.message });
  }
});

module.exports = router;
