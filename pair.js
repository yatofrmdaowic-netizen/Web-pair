const express = require("express");
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
  const number = req.query.number;
  if (!number) return res.json({ status: false, message: "Number required" });

  const id = makeid();
  const sessionPath = path.join(__path, "temp", id);
  fs.mkdirSync(sessionPath, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" })
  });

  sock.ev.on("creds.update", saveCreds);

  try {
    const code = await sock.requestPairingCode(number.replace(/\D/g, ""));
    res.json({
      status: true,
      pairing_code: code,
      session_id: id
    });
  } catch (err) {
    res.json({ status: false, error: err.message });
  }
});

module.exports = router;
