const express = require("express");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const path = require("path");

const router = express.Router();

router.get("/", async (req, res) => {
  const number = (req.query.number || "").toString().replace(/\D/g, "");
  if (!number) {
    return res.json({ status: false, message: "Number required with country code" });
  }

  let responseSent = false;
  let sock;

  const sendOnce = (payload) => {
    if (responseSent) return;
    responseSent = true;
    res.json(payload);
  };

  try {
    // Keep auth isolated per number so stale creds do not block new linking requests.
    const authPath = path.join(process.cwd(), "auth", number);

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "silent" }),
      browser: ["Slime Bot", "Chrome", "1.0.0"],
      printQRInTerminal: false,
      markOnlineOnConnect: false
    });

    sock.ev.on("creds.update", saveCreds);

    let pairingRequested = false;

    sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        if (!responseSent && statusCode !== DisconnectReason.loggedOut) {
          sendOnce({
            status: false,
            error: "Connection closed before pairing. Please try again."
          });
        }
      }

      if ((connection === "connecting" || connection === "open") && !pairingRequested && !sock.authState.creds.registered) {
        pairingRequested = true;
        try {
          const code = await sock.requestPairingCode(number);
          sendOnce({
            status: true,
            pairing_code: code
          });
        } catch (err) {
          sendOnce({
            status: false,
            error: err.message
          });
        }
      }
    });

    // Fallback so request does not hang indefinitely.
    setTimeout(() => {
      if (!responseSent) {
        sendOnce({
          status: false,
          error: "Timed out while creating pairing code."
        });
      }
    }, 20000);
  } catch (err) {
    sendOnce({
      status: false,
      error: err.message
    });
  }
});

module.exports = router;
