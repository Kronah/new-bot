"use strict";

const { getMessageText, reply } = require("../lib/messages");
const {
  isSubscribedToBossAlerts,
  subscribeBossAlerts,
  unsubscribeBossAlerts
} = require("../lib/boss-alerts");
const { formatBossStatus, getBossStatus } = require("../lib/boss-status");

async function handleBoss(sock, msg) {
  const text = getMessageText(msg).trim();

  if (isBossAlertCommand(text)) {
    await handleBossAlertCommand(sock, msg, text);
    return;
  }

  const filter = parseFilter(text);

  await sendPresence(sock, msg, "composing");

  try {
    const data = await getBossStatus();
    await reply(sock, msg, formatBossStatus(data, filter));
  } catch (error) {
    console.error("Erro Boss Status:", error.message);
    await reply(sock, msg, `Nao consegui buscar os bosses agora.\n${error.message}`);
  } finally {
    await sendPresence(sock, msg, "paused");
  }
}

function isBossCommand(text) {
  const value = String(text || "").trim();
  return /^!boss(?:\s|$)/i.test(value) || isBossAlertCommand(value);
}

function isBossAlertCommand(text) {
  return /^!bossalert(?:\s|$)/i.test(String(text || "").trim());
}

async function handleBossAlertCommand(sock, msg, text) {
  const jid = msg.key.remoteJid;
  const lowerText = String(text || "").toLowerCase();

  if (/\b(off|desativar|parar|stop)\b/.test(lowerText)) {
    unsubscribeBossAlerts(jid);
    await reply(sock, msg, "\uD83D\uDD15 Alertas de boss desativados neste chat.");
    return;
  }

  if (/\b(status)\b/.test(lowerText)) {
    const enabled = isSubscribedToBossAlerts(jid);
    await reply(sock, msg, enabled
      ? "\uD83D\uDD14 Alertas de boss estao ativos neste chat."
      : "\uD83D\uDD15 Alertas de boss estao desativados neste chat.");
    return;
  }

  subscribeBossAlerts(jid);
  await reply(sock, msg, [
    "\uD83D\uDD14 Alertas de boss ativados neste chat.",
    "",
    "Vou avisar quando faltar 1 hora e repetir de 20 em 20 minutos ate ficar vivo.",
    "Tambem aviso quando o site mostrar o boss como vivo.",
    "",
    "Para desligar: !bossalert off"
  ].join("\n"));
}

function parseFilter(text) {
  const lowerText = String(text || "").toLowerCase();

  if (lowerText.includes("epic")) return "epic";
  if (lowerText.includes("raid")) return "raid";

  return "all";
}

async function sendPresence(sock, msg, presence) {
  try {
    await sock.sendPresenceUpdate(presence, msg.key.remoteJid);
  } catch (error) {
    console.error(`Falha ao atualizar presenca (${presence}):`, error.message);
  }
}

module.exports = {
  handleBoss,
  isBossCommand
};
