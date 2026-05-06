"use strict";

const fs = require("fs");
const path = require("path");

function initLogger(serviceName = "app") {
  const safeName = String(serviceName || "app").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-") || "app";
  const dataDir = path.resolve(__dirname, "..", "..", "data");
  const outFile = path.join(dataDir, `${safeName}.log`);
  const errorFile = path.join(dataDir, `${safeName}-error.log`);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const rawLog = console.log.bind(console);
  const rawInfo = console.info.bind(console);
  const rawWarn = console.warn.bind(console);
  const rawError = console.error.bind(console);

  function write(level, filePath, args) {
    const timestamp = new Date().toISOString();
    const message = args.map(formatArg).join(" ");
    const line = `[${timestamp}] [${safeName}] [${level}] ${message}`;

    try {
      fs.appendFileSync(filePath, `${line}\n`);
    } catch (e) {}
    return line;
  }

  console.log = (...args) => rawLog(write("INFO", outFile, args));
  console.info = (...args) => rawInfo(write("INFO", outFile, args));
  console.warn = (...args) => rawWarn(write("WARN", outFile, args));
  console.error = (...args) => rawError(write("ERROR", errorFile, args));

  return {
    outFile,
    errorFile
  };
}

function formatArg(value) {
  if (value instanceof Error) {
    return value.stack || value.message;
  }

  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

module.exports = {
  initLogger
};
