"use strict";

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(__dirname, "..", "..", "data");
const STATUS_FILE = path.join(DATA_DIR, "status.json");

function ensureDataDir() {
  if (!fs.existsSync(path.dirname(STATUS_FILE))) {
    fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
  }
}

function readStatus() {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      const raw = fs.readFileSync(STATUS_FILE, "utf8");
      return JSON.parse(raw);
    }
  } catch (error) {
    console.error("Erro ao ler status:", error);
  }
  return {
    connection: "unknown",
    qr: null,
    lastError: null,
    updatedAt: null
  };
}

function writeStatus(update) {
  ensureDataDir();

  const current = readStatus();
  const next = {
    ...current,
    ...update,
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(STATUS_FILE, JSON.stringify(next, null, 2));
  return next;
}

module.exports = {
  readStatus,
  writeStatus
};
