/* Elegant European hotel-style certificate border override. Loaded after voucher-admin.js. */
(function () {
  const BOOKING_URL = "https://www.casmartstaycation.com/";

  function loadQr(text) {
    return new Promise((resolve, reject) => {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => resolve(img); img.onerror = () => reject(new Error("Unable to load booking QR code."));
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=${encodeURIComponent(text)}`;
    });
  }

  function ornament(ctx, x, y, rotation, scale = 1) {
    ctx.save(); ctx.translate(x,y); ctx.rotate(rotation); ctx.scale(scale,scale);
    ctx.strokeStyle="#b08a3c"; ctx.fillStyle="#d8b45b"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.bezierCurveTo(20,2,34,12,44,32); ctx.bezierCurveTo(58,13,72,5,96,5); ctx.bezierCurveTo(76,20,64,39,58,62); ctx.bezierCurveTo(40,48,23,35,0,30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8,8); ctx.bezierCurveTo(30,12,42,25,49,47); ctx.bezierCurveTo(62,30,76,22,91,20); ctx.stroke();
    ctx.beginPath(); ctx.arc(48,17,4,0,Math.PI*2); ctx.fill(); ctx.restore();
  }

  function divider(ctx,cx,y,flip=false){
    ctx.save(); ctx.translate(cx,y); if(flip)ctx.scale(1,-1); ctx.strokeStyle="#b08a3c"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(-260,0); ctx.bezierCurveTo(-215,0,-198,-20,-164,-22); ctx.bezierCurveTo(-130,-24,-120,-4,-91,0); ctx.bezierCurveTo(-64,5,-48,-8,-29,-20); ctx.bezierCurveTo(-14,-28,-7,-17,0,0); ctx.bezierCurveTo(7,-17,14,-28,29,-20); ctx.bezierCurveTo(48,-8,64,5,91,0); ctx.bezierCurveTo(120,-4,130,-24,164,-22); ctx.bezierCurveTo(198,-20,215,0,260,0); ctx.stroke();
    ctx.beginPath(); ctx.arc(0,0,4,0,Math.PI*2); ctx.fillStyle="#d8b45b"; ctx.fill(); ctx.restore();
  }

  window.certificateImage = async function(v, guest) {
    const c=document.createElement("canvas"),x=c.getContext("2d"); c.width=1600;c.height=760;const W=c.width,H=c.height;
    const bg=x.createLinearGradient(0,0,W,H);bg.addColorStop(0,"#faf5e9");bg.addColorStop(.5,"#fffdf8");bg.addColorStop(1,"#f1e7d0");x.fillStyle=bg;x.fillRect(0,0,W,H);

    // Elegant layered European hotel frame — restrained gold and emerald.
    x.strokeStyle="#173f35";x.lineWidth=18;x.strokeRect(24,24,W-48,H-48);
    x.strokeStyle="#d8b45b";x.lineWidth=3;x.strokeRect(43,43,W-86,H-86);
    x.strokeStyle="#b08a3c";x.lineWidth=1;x.strokeRect(51,51,W-102,H-102);
    x.strokeStyle="#173f35";x.lineWidth=1;x.strokeRect(57,57,W-114,H-114);
    ornament(x,64,64,0,1.18);ornament(x,W-64,64,Math.PI/2,1.18);ornament(x,W-64,H-64,Math.PI,1.18);ornament(x,64,H-64,-Math.PI/2,1.18);
    divider(x,W/2,64,false);divider(x,W/2,H-64,true);

    x.textAlign="left";x.fillStyle="#173f35";x.font="bold 23px Georgia";x.fillText("CA SMART STAYCATION",100,112);
    x.fillStyle="#b08a3c";x.font="13px Georgia";x.fillText("SPECIAL GUEST PRIVILEGE",100,135);
    x.textAlign="center";x.fillStyle="#173f35";x.font="bold 48px Georgia";x.fillText(v.certificateTitle||"SPECIAL GUEST VOUCHER",800,202);
    x.fillStyle="#a67c32";x.font="bold 60px Georgia";x.fillText(`${v.discountPercent}% OFF`,800,288);
    x.fillStyle="#555a56";x.font="21px Georgia";x.fillText("Presented exclusively to",800,334);
    x.fillStyle="#173f35";x.font="bold 40px Georgia";x.fillText(guest||"Special Guest",800,388);
    x.fillStyle="#8a672d";x.font="bold 19px Arial";x.fillText(`VOUCHER CODE  •  ${v.code}`,800,440);
    x.fillStyle="#555a56";x.font="17px Arial";x.fillText(v.maxNights?`Valid for up to ${v.maxNights} night${v.maxNights===1?"":"s"}`:"No night limit",800,474);
    x.fillText(v.expiresAt?`Valid until ${new Date(v.expiresAt).toLocaleDateString("en-PH",{year:"numeric",month:"long",day:"numeric"})}`:"No expiration date",800,502);
    x.fillStyle="#8a672d";x.font="bold 17px Arial";x.fillText(v.discountPercent===100?"COMPLIMENTARY STAY  •  NON-REFUNDABLE  •  NON-CANCELLABLE":"SPECIAL GUEST PRIVILEGE",800,542);

    x.textAlign="left";x.fillStyle="#173f35";x.font="bold 14px Arial";x.fillText("BOOK YOUR STAY",100,570);x.fillStyle="#8a672d";x.font="bold 15px Arial";x.fillText(BOOKING_URL.replace(/^https?:\/\//,""),100,595);x.fillStyle="#555a56";x.font="13px Arial";x.fillText("Scan the QR code or visit the website to book.",100,618);x.fillStyle="#a67c32";x.font="italic 15px Georgia";x.fillText("Elegance • Comfort • Exceptional Stay",100,680);
    try{const qr=await loadQr(BOOKING_URL);x.fillStyle="#fff";x.fillRect(1310,120,200,200);x.strokeStyle="#b08a3c";x.lineWidth=2;x.strokeRect(1310,120,200,200);x.drawImage(qr,1322,132,176,176);x.fillStyle="#173f35";x.textAlign="center";x.font="bold 15px Arial";x.fillText("SCAN TO BOOK",1410,345)}catch(e){x.fillStyle="#555a56";x.textAlign="center";x.font="13px Arial";x.fillText("QR unavailable",1410,220)}
    return c.toDataURL("image/png");
  };
})();
