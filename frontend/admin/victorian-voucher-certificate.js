/* Victorian-style certificate border override. Loaded after voucher-admin.js. */
(function () {
  const BOOKING_URL = "https://casmartstaycation.github.io/cassbooking/";

  function loadQr(text) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Unable to load booking QR code."));
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=${encodeURIComponent(text)}`;
    });
  }

  function drawVictorianCorner(ctx, x, y, rotation, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
    ctx.strokeStyle = "#d8b45b";
    ctx.fillStyle = "#d8b45b";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(18, 2, 31, 12, 39, 31);
    ctx.bezierCurveTo(52, 13, 68, 4, 94, 5);
    ctx.bezierCurveTo(76, 19, 63, 38, 58, 65);
    ctx.bezierCurveTo(41, 51, 25, 37, 0, 31);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(7, 8);
    ctx.bezierCurveTo(29, 12, 42, 25, 48, 48);
    ctx.bezierCurveTo(61, 31, 76, 22, 91, 20);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(17, 17);
    ctx.bezierCurveTo(24, 7, 35, 7, 42, 17);
    ctx.bezierCurveTo(35, 21, 27, 21, 17, 17);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(47, 17, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawVictorianDivider(ctx, cx, y, flip = false) {
    ctx.save();
    ctx.translate(cx, y);
    if (flip) ctx.scale(1, -1);
    ctx.strokeStyle = "#d8b45b";
    ctx.fillStyle = "#d8b45b";
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.moveTo(-260, 0);
    ctx.bezierCurveTo(-215, 0, -198, -24, -164, -25);
    ctx.bezierCurveTo(-130, -27, -120, -5, -91, 0);
    ctx.bezierCurveTo(-66, 5, -49, -10, -30, -21);
    ctx.bezierCurveTo(-16, -29, -8, -19, 0, 0);
    ctx.bezierCurveTo(8, -19, 16, -29, 30, -21);
    ctx.bezierCurveTo(49, -10, 66, 5, 91, 0);
    ctx.bezierCurveTo(120, -5, 130, -27, 164, -25);
    ctx.bezierCurveTo(198, -24, 215, 0, 260, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-82, -7);
    ctx.bezierCurveTo(-72, -39, -43, -48, -25, -21);
    ctx.bezierCurveTo(-17, -10, -8, -4, 0, 0);
    ctx.bezierCurveTo(8, -4, 17, -10, 25, -21);
    ctx.bezierCurveTo(43, -48, 72, -39, 82, -7);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  window.certificateImage = async function (v, guest) {
    const c = document.createElement("canvas");
    const x = c.getContext("2d");
    c.width = 1600;
    c.height = 760;
    const W = c.width;
    const H = c.height;

    const bg = x.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#f8f0df");
    bg.addColorStop(0.5, "#fffaf0");
    bg.addColorStop(1, "#efe2c5");
    x.fillStyle = bg;
    x.fillRect(0, 0, W, H);

    // Victorian multi-layer frame: warm gold, deep green, antique gold.
    x.strokeStyle = "#8a672d";
    x.lineWidth = 18;
    x.strokeRect(24, 24, W - 48, H - 48);
    x.strokeStyle = "#d8b45b";
    x.lineWidth = 5;
    x.strokeRect(47, 47, W - 94, H - 94);
    x.strokeStyle = "#173f35";
    x.lineWidth = 3;
    x.strokeRect(60, 60, W - 120, H - 120);
    x.strokeStyle = "#b08a3c";
    x.lineWidth = 1.5;
    x.strokeRect(69, 69, W - 138, H - 138);

    drawVictorianCorner(x, 72, 72, 0, 1.35);
    drawVictorianCorner(x, W - 72, 72, Math.PI / 2, 1.35);
    drawVictorianCorner(x, W - 72, H - 72, Math.PI, 1.35);
    drawVictorianCorner(x, 72, H - 72, -Math.PI / 2, 1.35);
    drawVictorianDivider(x, W / 2, 72, false);
    drawVictorianDivider(x, W / 2, H - 72, true);

    // Small Victorian side medallions.
    x.strokeStyle = "#b08a3c";
    x.lineWidth = 2;
    [H / 2].forEach((cy) => {
      [73, W - 73].forEach((cx, i) => {
        x.beginPath();
        x.arc(cx, cy, 17, 0, Math.PI * 2);
        x.stroke();
        x.beginPath();
        x.arc(cx, cy, 7, 0, Math.PI * 2);
        x.fillStyle = "#d8b45b";
        x.fill();
        x.fillStyle = "#173f35";
      });
    });

    x.textAlign = "left";
    x.fillStyle = "#173f35";
    x.font = "bold 24px Georgia";
    x.fillText("CA SMART STAYCATION", 105, 115);
    x.fillStyle = "#8a672d";
    x.font = "14px Georgia";
    x.fillText("SPECIAL GUEST PRIVILEGE", 105, 139);

    x.textAlign = "center";
    x.fillStyle = "#173f35";
    x.font = "bold 50px Georgia";
    x.fillText(v.certificateTitle || "SPECIAL GUEST VOUCHER", 800, 205);

    x.fillStyle = "#a67c32";
    x.font = "bold 62px Georgia";
    x.fillText(`${v.discountPercent}% OFF`, 800, 292);

    x.fillStyle = "#4c514d";
    x.font = "22px Georgia";
    x.fillText("Presented exclusively to", 800, 338);
    x.fillStyle = "#173f35";
    x.font = "bold 42px Georgia";
    x.fillText(guest || "Special Guest", 800, 393);

    x.fillStyle = "#8a672d";
    x.font = "bold 20px Arial";
    x.fillText(`VOUCHER CODE  •  ${v.code}`, 800, 446);
    x.fillStyle = "#4c514d";
    x.font = "18px Arial";
    x.fillText(v.maxNights ? `Valid for up to ${v.maxNights} night${v.maxNights === 1 ? "" : "s"}` : "No night limit", 800, 482);
    x.fillText(v.expiresAt ? `Valid until ${new Date(v.expiresAt).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}` : "No expiration date", 800, 512);

    x.fillStyle = "#8a672d";
    x.font = "bold 18px Arial";
    x.fillText(v.discountPercent === 100 ? "COMPLIMENTARY STAY  •  NON-REFUNDABLE  •  NON-CANCELLABLE" : "SPECIAL GUEST PRIVILEGE", 800, 555);

    x.textAlign = "left";
    x.fillStyle = "#173f35";
    x.font = "bold 14px Arial";
    x.fillText("BOOK YOUR STAY", 105, 570);
    x.fillStyle = "#8a672d";
    x.font = "bold 15px Arial";
    x.fillText(BOOKING_URL.replace(/^https?:\/\//, ""), 105, 595);
    x.fillStyle = "#4c514d";
    x.font = "13px Arial";
    x.fillText("Scan the QR code or visit the website to book.", 105, 620);
    x.fillStyle = "#a67c32";
    x.font = "italic 15px Georgia";
    x.fillText("Elegance • Comfort • Exceptional Stay", 105, 680);

    try {
      const qr = await loadQr(BOOKING_URL);
      x.fillStyle = "#fff";
      x.fillRect(1310, 120, 200, 200);
      x.strokeStyle = "#b08a3c";
      x.lineWidth = 2;
      x.strokeRect(1310, 120, 200, 200);
      x.drawImage(qr, 1322, 132, 176, 176);
      x.fillStyle = "#173f35";
      x.textAlign = "center";
      x.font = "bold 15px Arial";
      x.fillText("SCAN TO BOOK", 1410, 345);
    } catch (e) {
      x.fillStyle = "#4c514d";
      x.textAlign = "center";
      x.font = "13px Arial";
      x.fillText("QR unavailable", 1410, 220);
    }

    return c.toDataURL("image/png");
  };
})();