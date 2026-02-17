const express = require("express");
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const path = require("path");

const router = express.Router();

router.get("/", async (req, res) => {
    const number = req.query.number;
    if (!number) {
        return res.json({ status: false, message: "Number required with country code" });
    }

    try {
        // Use ONE fixed auth folder
        const authPath = path.join(process.cwd(), "auth");

        const { state, saveCreds } = await useMultiFileAuthState(authPath);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: "silent" }),
            browser: ["Slime Bot", "Chrome", "1.0.0"]
        });

        sock.ev.on("creds.update", saveCreds);

        // Wait before requesting pairing code
        setTimeout(async () => {
            try {
                const cleanNumber = number.replace(/\D/g, "");
                const code = await sock.requestPairingCode(cleanNumber);

                res.json({
                    status: true,
                    pairing_code: code
                });

            } catch (err) {
                res.json({
                    status: false,
                    error: err.message
                });
            }
        }, 5000);

    } catch (err) {
        res.json({
            status: false,
            error: err.message
        });
    }
});

module.exports = router;
