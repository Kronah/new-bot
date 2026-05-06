"use strict";

const { initLogger } = require("./lib/logger");
initLogger("server");

const {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeWASocket,
  useMultiFileAuthState
} = require("@whiskeysockets/baileys");
const P = require("pino");
const express = require("express");
const QRCode = require("qrcode");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const { readStatus, writeStatus } = require("./lib/runtime-status");
const { startBossAlerts } = require("./lib/boss-alerts");
const { startOutboundProcessor } = require("./lib/outbound-messages");
const { startReminderProcessor } = require("./lib/group-reminders");
const { updateKnownGroupsFromSocket } = require("./lib/group-settings");

const AUTH_DIR = process.env.AUTH_DIR || "auth_info";
const BOT_NAME = process.env.BOT_NAME || "Novo BOT Cloud";
const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());

// API para o Painel Web
app.get("/api/status", async (req, res) => {
  const runtime = readStatus();
  const qrImage = runtime.qr ? await QRCode.toDataURL(runtime.qr, { margin: 1, width: 320 }) : null;
  res.json({
    botName: BOT_NAME,
    connection: runtime.connection,
    qrImage,
    updatedAt: runtime.updatedAt
  });
});

async function startServer() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    browser: [BOT_NAME, "Chrome", "1.0.0"],
    logger: P({ level: "silent" }),
    printQRInTerminal: true
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      writeStatus({ connection: "qr", qr });
    }

    if (connection === "open") {
      writeStatus({ connection: "open", qr: null });
      console.log("Bot Conectado!");
      startBossAlerts(sock);
      startOutboundProcessor(sock);
      startReminderProcessor(sock);
      updateKnownGroupsFromSocket(sock).catch(e => console.error(e));
    }

    if (connection === "close") {
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
      writeStatus({ connection: "close", qr: null });
      if (shouldReconnect) startServer();
    }
  });
}

app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
  startServer().catch(err => console.error("Erro ao iniciar bot:", err));
});
