const express = require("express");
const QRCode = require("qrcode");
const {
  default: makeWASocket,
  useMultiFileAuthState
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const { makeid } = require("./lib/gen-id");

const router = express.Router();

router.get("/", async (req, res) => {
  const id = makeid();
  const sessionPath = path.join(__path, "temp", id);
  fs.mkdirSync(sessionPath, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", async ({ qr }) => {
    if (qr) {
      const qrImage = await QRCode.toBuffer(qr);
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end(qrImage);
    }
  });
});

module.exports = router;
