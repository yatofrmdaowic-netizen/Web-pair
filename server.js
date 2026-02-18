const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8000;

global.__path = process.cwd();

require("events").EventEmitter.defaultMaxListeners = 500;

// Parse body
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use("/server", require("./qr"));
app.use("/code", require("./pair"));

// Static assets
app.use(express.static(path.join(__path, "public")));

// Serve HTML
app.get("/qr", (req, res) => res.sendFile(path.join(__path, "public/qr.html")));
app.get("/pair", (req, res) => res.sendFile(path.join(__path, "public/pair.html")));
app.get("/", (req, res) => res.sendFile(path.join(__path, "public/main.html")));

app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
