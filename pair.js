const express = require("express");
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const { makeid } = require("./lib/gen-id");

const router = express.Router();

router.get("/", async (req, res) => {
    const number = req.query.number;

    if (!number) {
        return res.json({ status: false, message: "Number required with country code" });
    }

    try {
        const id = makeid();
        const sessionPath = path.join(process.cwd(), "temp", id);
        fs.mkdirSync(sessionPath, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: "silent" }),
            browser: ["Slime Pair", "Chrome", "120.0.0"]
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async (update) => {
            if (update.connection === "connecting") {
                console.log("Connecting...");
            }

            if (update.connection === "open") {
                console.log("Connected");
            }
        });

        // IMPORTANT: small delay before requesting code
        setTimeout(async () => {
            try {
                const cleanNumber = number.replace(/\D/g, "");
                const code = await sock.requestPairingCode(cleanNumber);

                res.json({
                    status: true,
                    pairing_code: code,
                    session_id: id
                });
            } catch (err) {
                res.json({
                    status: false,
                    error: err.message
                });
            }
        }, 4000);

    } catch (error) {
        res.json({
            status: false,
            error: error.message
        });
    }
});

module.exports = router;
