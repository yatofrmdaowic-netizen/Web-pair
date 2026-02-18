const express = require("express");
const QRCode = require("qrcode");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const { makeid } = require("./lib/gen-id");

const router = express.Router();

const handleQrRequest = async (req, res) => {
  const id = makeid();
  const sessionPath = path.join(__path, "temp", id);
  fs.mkdirSync(sessionPath, { recursive: true });

  let sock;
  let responseSent = false;

  const cleanup = async () => {
    try {
      if (sock) {
        sock.ev.removeAllListeners("connection.update");
        sock.ev.removeAllListeners("creds.update");
        await sock.end(new Error("QR request finished"));
      }
    } catch (_err) {
      // ignore close errors
    }

    fs.rm(sessionPath, { recursive: true, force: true }, () => {});
  };

  const sendOnce = async (status, payload, headers = { "Content-Type": "application/json" }) => {
    if (responseSent) return;
    responseSent = true;
    res.writeHead(status, headers);
    res.end(payload);
    await cleanup();
  };

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    sock = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      markOnlineOnConnect: false
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async ({ qr, connection, lastDisconnect }) => {
      if (qr) {
        try {
          const qrImage = await QRCode.toBuffer(qr);
          await sendOnce(200, qrImage, { "Content-Type": "image/png" });
        } catch (error) {
          await sendOnce(500, JSON.stringify({ status: false, error: error.message }));
        }
        return;
      }

      if (connection === "close" && !responseSent) {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const message = statusCode === DisconnectReason.loggedOut
          ? "Session logged out before QR generation."
          : "Connection closed before QR generation.";

        await sendOnce(503, JSON.stringify({ status: false, error: message }));
      }
    });

    setTimeout(async () => {
      if (!responseSent) {
        await sendOnce(504, JSON.stringify({ status: false, error: "Timed out while generating QR." }));
      }
    }, 20000);
  } catch (error) {
    await sendOnce(500, JSON.stringify({ status: false, error: error.message }));
  }
};

router.get("/", handleQrRequest);
router.get("/qr", handleQrRequest);

module.exports = router;
