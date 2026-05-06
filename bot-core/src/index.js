"use strict";

const { initLogger } = require("./lib/logger");
initLogger("bot");

const {
  DisconnectReason,
  downloadContentFromMessage,
  fetchLatestBaileysVersion,
  makeWASocket,
  useMultiFileAuthState
} = require("@whiskeysockets/baileys");
const P = require("pino");
const qrcode = require("qrcode-terminal");

const { handleBoss, isBossCommand } = require("./handlers/boss");
const { handleMenu } = require("./handlers/menu");
const { handleIa } = require("./handlers/ia");
const { handleOly, isOlyCommand } = require("./handlers/oly");
const { getMessageSenderJid, isAdminJid } = require("./lib/admins");
const { startBossAlerts } = require("./lib/boss-alerts");
const {
  getGroupsWithSettings,
  isGroupFeatureEnabled,
  updateKnownGroupsFromSocket,
  upsertKnownGroup
} = require("./lib/group-settings");
const { rememberInboundMessage } = require("./lib/inbound-messages");
const { getMessageText, reply } = require("./lib/messages");
const { startOutboundProcessor } = require("./lib/outbound-messages");
const { createGroupReminder, startReminderProcessor } = require("./lib/group-reminders");
const { writeStatus } = require("./lib/runtime-status");

const AUTH_DIR = process.env.AUTH_DIR || "auth_info";
const BOT_NAME = process.env.BOT_NAME || "Novo BOT";
const IA_SESSION_TTL_MS = Number(process.env.IA_SESSION_TTL_MS || 5 * 60 * 1000);
const RECONNECT_DELAY_MS = Number(process.env.RECONNECT_DELAY_MS || 3000);
const GROUP_LIST_CACHE_TTL_MS = Number(process.env.GROUP_LIST_CACHE_TTL_MS || 30 * 60 * 1000);
const EVENT_SESSION_TTL_MS = Number(process.env.EVENT_SESSION_TTL_MS || 20 * 60 * 1000);
const iaSessions = new Map();
const privateGroupListCache = new Map();
const privateEventSessions = new Map();
let reconnectTimer = null;
let reconnectAttempts = 0;

async function startBot() {
  writeStatus({
    botName: BOT_NAME,
    connection: "starting",
    lastError: null
  });

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    browser: [BOT_NAME, "Chrome", "1.0.0"],
    logger: P({ level: process.env.LOG_LEVEL || "silent" }),
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      writeStatus({
        botName: BOT_NAME,
        connection: "qr",
        qr,
        lastError: null
      });
      console.log("Leia este QR Code no WhatsApp para conectar:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      writeStatus({
        botName: BOT_NAME,
        connection: "open",
        qr: null,
        lastError: null
      });
      startBossAlerts(sock);
      reconnectAttempts = 0;
      startOutboundProcessor(sock);
      startReminderProcessor(sock);
      updateKnownGroupsFromSocket(sock)
        .then((groups) => console.log(`Grupos carregados: ${groups.length}`))
        .catch((error) => console.error("Erro ao carregar grupos:", error.message));
      console.log(`${BOT_NAME} conectado com sucesso.`);
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      const lastError = lastDisconnect?.error?.message || "Conexao fechada";

      writeStatus({
        botName: BOT_NAME,
        connection: "close",
        qr: null,
        lastError,
        shouldReconnect
      });

      console.log(`Conexao fechada. Reconectar: ${shouldReconnect}`);

      if (shouldReconnect) {
        if (reconnectTimer) return;

        reconnectAttempts += 1;
        const backoff = RECONNECT_DELAY_MS * Math.pow(2, Math.min(reconnectAttempts - 1, 6));
        console.log(`Aguardando ${Math.round(backoff / 1000)}s antes de reconectar (tentativa ${reconnectAttempts})...`);
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          startBot().catch((error) => console.error("Erro ao reconectar:", error));
        }, backoff);
      } else {
        console.log("Sessao encerrada. Apague auth_info e leia o QR Code novamente se quiser reconectar.");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        await routeMessage(sock, msg);
      } catch (error) {
        console.error("Erro ao processar mensagem:", error.message);
      }
    }
  });
}

async function routeMessage(sock, msg) {
  if (!msg.message) {
    console.log("Mensagem ignorada: sem payload.");
    return;
  }

  if (msg.key.fromMe) {
    console.log(`Mensagem ignorada: fromMe jid=${msg.key.remoteJid || "-"}`);
    return;
  }

  const jid = msg.key.remoteJid;
  const text = getMessageText(msg).trim();

  if (!jid) {
    console.log("Mensagem ignorada: sem jid.");
    return;
  }

  if (jid === "status@broadcast") {
    console.log("Mensagem ignorada: status broadcast.");
    return;
  }

  const isGroup = jid.endsWith("@g.us");
  const senderJid = getMessageSenderJid(msg);
  const isAdmin = isAdminJid(senderJid);
  const isGroupListCommand = !isGroup && /^\s*\/bot\s+grupo\b/i.test(stripCommandMarks(text));
  const relayCommand = !isGroup ? parsePrivateGroupRelayCommand(text) : null;
  const isBotCommandPrefix = /^\s*\/bot\b/i.test(stripCommandMarks(text));

  if (isGroup) {
    upsertKnownGroup({ jid });
  }

  console.log([
    "Mensagem recebida",
    `tipo=${isGroup ? "grupo" : "privado"}`,
    `jid=${jid}`,
    `sender=${senderJid || "-"}`,
    `admin=${isAdmin ? "sim" : "nao"}`,
    `texto=${text ? "sim" : "nao"}`
  ].join(" "));

  const isEventCommand = /^\/evento\b/i.test(stripCommandMarks(text));

  if (isGroup && isEventCommand) {
    await reply(sock, msg, "O comando /evento funciona apenas no privado do bot.");
    return;
  }

  if (!isGroup) {
    const handledEventFlow = await handlePrivateEventFlow(sock, msg, {
      senderJid,
      text,
      isEventCommand
    });

    if (handledEventFlow) return;
  }

  if (!text) return;

  rememberInboundMessage(msg, text);

  const lowerText = text.toLowerCase().trim();
  const isMenuCommand = ["menu", "inicio", "iniciar", "voltar", "0"].includes(lowerText);
  const prefixMatch = text.match(/^\s*[!./]?(ia|ai|bot|gemini)\b/i);
  const iaPrefix = prefixMatch ? String(prefixMatch[1] || "").toLowerCase() : "";
  const hasIaPrefix = Boolean(iaPrefix);
  const preferOnline = hasIaPrefix && iaPrefix !== "bot";
  const isLearningCommand = /^\s*(aprenda|ensine|corrija)\s*:/i.test(text);
  const isIaSessionActive = isGroup && hasActiveIaSession(jid, senderJid);
  const shouldHandleIa = !isGroup || hasIaPrefix || isLearningCommand || isIaSessionActive;

  if (!isAdmin && isGroup && !isGroupFeatureEnabled(jid, "bot")) {
    console.log(`Mensagem ignorada: bot desativado no grupo jid=${jid}`);
    return;
  }

  if (isBossCommand(text)) {
    if (!isAdmin && isGroup && !isGroupFeatureEnabled(jid, "boss")) {
      console.log(`Comando boss ignorado: desativado no grupo jid=${jid}`);
      return;
    }

    await handleBoss(sock, msg);
    return;
  }

  if (isOlyCommand(text)) {
    if (!isAdmin && isGroup && !isGroupFeatureEnabled(jid, "oly")) {
      console.log(`Comando oly ignorado: desativado no grupo jid=${jid}`);
      return;
    }

    await handleOly(sock, msg);
    return;
  }

  if (isMenuCommand) {
    await handleMenu(sock, msg);
    return;
  }

  if (isGroupListCommand) {
    try {
      await updateKnownGroupsFromSocket(sock);
    } catch (error) {
      console.error("Falha ao atualizar nomes dos grupos:", error.message);
    }

    const groups = getGroupsWithSettings();
    rememberPrivateGroupList(senderJid, groups);
    await reply(sock, msg, formatGroupOptions(groups));
    return;
  }

  if (!isGroup && isBotCommandPrefix && !relayCommand) {
    await reply(sock, msg, "Comando invalido. Use: /bot fala no grupo <nome-do-grupo> <mensagem>");
    return;
  }

  if (relayCommand) {
    try {
      await updateKnownGroupsFromSocket(sock);
    } catch (error) {
      console.error("Falha ao atualizar grupos antes do relay:", error.message);
    }

    const groups = getGroupsWithSettings();
    const resolved = relayCommand.groupIndex
      ? resolveRelayByIndex(groups, relayCommand.groupIndex, relayCommand.message, senderJid)
      : resolveRelayTarget(groups, relayCommand.payload, senderJid);

    if (!resolved.group) {
      const options = formatGroupOptions(groups);
      await reply(sock, msg, [
        "Nao encontrei esse grupo.",
        "Use: /bot fala no grupo <nome-do-grupo> <mensagem>",
        options
      ].join("\n"));
      return;
    }

    if (!resolved.message) {
      await reply(sock, msg, "Faltou a mensagem. Exemplo: /bot fala no grupo Bot-Adm que o ace e chato");
      return;
    }

    try {
      await sock.sendMessage(resolved.group.jid, { text: resolved.message });
      await reply(sock, msg, `Mensagem enviada para ${resolved.group.name || resolved.group.jid} (${resolved.group.jid}).`);
    } catch (error) {
      await reply(sock, msg, `Falha ao enviar para ${resolved.group.name || resolved.group.jid}: ${error.message}`);
    }
    return;
  }

  if (shouldHandleIa) {
    if (!isAdmin && isGroup) {
      if (iaPrefix === "bot") {
        if (!isGroupFeatureEnabled(jid, "zoeira")) {
          console.log(`Zoeira ignorada: desativada no grupo jid=${jid}`);
          return;
        }
      } else if (!isGroupFeatureEnabled(jid, "ia")) {
        console.log(`IA ignorada: desativada no grupo jid=${jid}`);
        return;
      }
    }

    await handleIa(sock, msg, {
      preferOnline,
      senderJid,
      isAdmin
    });

    if (isGroup && senderJid && (hasIaPrefix || isIaSessionActive || isLearningCommand)) {
      touchIaSession(jid, senderJid);
    }
  }
}

async function handlePrivateEventFlow(sock, msg, { senderJid, text, isEventCommand }) {
  if (!senderJid) return false;

  const commandText = stripCommandMarks(text);
  const session = getPrivateEventSession(senderJid);

  if (isEventCommand) {
    if (/^\/evento\s+cancelar\b/i.test(commandText)) {
      privateEventSessions.delete(senderJid);
      await reply(sock, msg, "Criacao de evento cancelada.");
      return true;
    }

    privateEventSessions.set(senderJid, {
      step: "await_name",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      name: "",
      message: "",
      imageUrl: "",
      imageDataUrl: "",
      groupJid: "",
      intervalMinutes: 0
    });
    await reply(sock, msg, "Vamos criar seu evento. Qual o nome do evento?");
    return true;
  }

  if (!session) return false;

  touchPrivateEventSession(senderJid, session);
  const cleanText = String(text || "").trim();

  if (/^(cancelar|sair)$/i.test(cleanText)) {
    privateEventSessions.delete(senderJid);
    await reply(sock, msg, "Criacao de evento cancelada.");
    return true;
  }

  if (session.step === "await_name") {
    if (!cleanText) {
      await reply(sock, msg, "Envie um nome valido para o evento.");
      return true;
    }

    session.name = cleanText;
    session.step = "await_message";
    touchPrivateEventSession(senderJid, session);
    await reply(sock, msg, "Agora envie a mensagem do evento.");
    return true;
  }

  if (session.step === "await_message") {
    if (!cleanText) {
      await reply(sock, msg, "Envie uma mensagem valida para o evento.");
      return true;
    }

    session.message = cleanText;
    session.step = "await_image_choice";
    touchPrivateEventSession(senderJid, session);
    await reply(sock, msg, "Quer anexar imagem? Responda: sim ou nao.");
    return true;
  }

  if (session.step === "await_image_choice") {
    if (/^(nao|não|n)$/i.test(cleanText)) {
      session.imageUrl = "";
      session.imageDataUrl = "";
      session.step = "await_group";
      touchPrivateEventSession(senderJid, session);
      await replyWithGroupOptions(sock, msg, senderJid);
      return true;
    }

    if (/^(sim|s)$/i.test(cleanText)) {
      session.step = "await_image_payload";
      touchPrivateEventSession(senderJid, session);
      await reply(sock, msg, "Envie a imagem agora (anexo) ou cole uma URL http/https. Se quiser pular, envie: pular");
      return true;
    }

    await reply(sock, msg, "Resposta invalida. Digite sim ou nao.");
    return true;
  }

  if (session.step === "await_image_payload") {
    if (/^pular$/i.test(cleanText)) {
      session.imageUrl = "";
      session.imageDataUrl = "";
      session.step = "await_group";
      touchPrivateEventSession(senderJid, session);
      await replyWithGroupOptions(sock, msg, senderJid);
      return true;
    }

    if (/^https?:\/\//i.test(cleanText)) {
      session.imageUrl = cleanText;
      session.imageDataUrl = "";
      session.step = "await_group";
      touchPrivateEventSession(senderJid, session);
      await replyWithGroupOptions(sock, msg, senderJid);
      return true;
    }

    const imageDataUrl = await extractImageDataUrlFromMessage(msg);
    if (imageDataUrl) {
      session.imageDataUrl = imageDataUrl;
      session.imageUrl = "";
      session.step = "await_group";
      touchPrivateEventSession(senderJid, session);
      await replyWithGroupOptions(sock, msg, senderJid);
      return true;
    }

    await reply(sock, msg, "Nao achei imagem. Envie anexo de imagem, URL http/https ou digite pular.");
    return true;
  }

  if (session.step === "await_group") {
    try {
      await updateKnownGroupsFromSocket(sock);
    } catch (error) {
      console.error("Falha ao atualizar grupos no /evento:", error.message);
    }

    const groups = getGroupsWithSettings();
    const selected = resolveGroupFromInput(groups, cleanText, senderJid);

    if (!selected) {
      await reply(sock, msg, [
        "Nao encontrei esse grupo.",
        "Envie o numero da lista ou nome/jid do grupo.",
        formatGroupOptions(getRememberedPrivateGroupList(senderJid, groups))
      ].join("\n"));
      return true;
    }

    session.groupJid = selected.jid;
    session.groupName = selected.name || selected.jid;
    session.step = "await_interval";
    touchPrivateEventSession(senderJid, session);
    await reply(sock, msg, "Em quantos minutos quer disparar o evento nesse grupo? (ex: 30)");
    return true;
  }

  if (session.step === "await_interval") {
    const minutes = Number(cleanText.replace(",", "."));
    if (!Number.isFinite(minutes) || minutes < 0) {
      await reply(sock, msg, "Intervalo invalido. Informe minutos (numero >= 0).");
      return true;
    }

    const intervalMinutes = Math.floor(minutes);
    const remindAt = new Date(Date.now() - 1000).toISOString();
    const eventText = [session.name, session.message].filter(Boolean).join("\n");

    try {
      const reminder = createGroupReminder({
        jid: session.groupJid,
        groupName: session.groupName,
        text: eventText,
        imageUrl: session.imageUrl,
        imageDataUrl: session.imageDataUrl,
        eventAt: remindAt,
        notifyBeforeMinutes: 0,
        remindAt,
        repeatMinutes: intervalMinutes
      });

      privateEventSessions.delete(senderJid);
      await reply(sock, msg, [
        "Evento criado com sucesso.",
        `Nome: ${session.name}`,
        `Grupo: ${session.groupName}`,
        "Primeiro disparo: imediato",
        `Repeticao: ${intervalMinutes} min`,
        `ID: ${reminder.id}`
      ].join("\n"));
    } catch (error) {
      await reply(sock, msg, `Falha ao criar evento: ${error.message}`);
    }

    return true;
  }

  return false;
}

function getPrivateEventSession(senderJid) {
  const session = privateEventSessions.get(senderJid);
  if (!session) return null;

  if (Date.now() - Number(session.updatedAt || 0) > EVENT_SESSION_TTL_MS) {
    privateEventSessions.delete(senderJid);
    return null;
  }

  return session;
}

function touchPrivateEventSession(senderJid, session) {
  if (!senderJid || !session) return;
  session.updatedAt = Date.now();
  privateEventSessions.set(senderJid, session);
}

async function replyWithGroupOptions(sock, msg, senderJid) {
  try {
    await updateKnownGroupsFromSocket(sock);
  } catch (error) {
    console.error("Falha ao atualizar grupos para /evento:", error.message);
  }

  const groups = getGroupsWithSettings();
  rememberPrivateGroupList(senderJid, groups);
  await reply(sock, msg, [
    "Qual grupo quer disparar o evento?",
    "Pode enviar o numero da lista ou nome/jid.",
    formatGroupOptions(groups)
  ].join("\n"));
}

function resolveGroupFromInput(groups, input, senderJid) {
  const raw = String(input || "").trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    const index = Number(raw);
    const ordered = getRememberedPrivateGroupList(senderJid, groups);
    if (Number.isInteger(index) && index >= 1 && index <= ordered.length) {
      return ordered[index - 1];
    }
  }

  const normalizedInput = normalizeText(raw);
  const direct = groups.find((group) => normalizeText(group.jid) === normalizedInput || normalizeText(group.name) === normalizedInput);
  if (direct) return direct;

  const partial = groups.filter((group) => {
    const name = normalizeText(group.name || "");
    const jid = normalizeText(group.jid || "");
    return name.includes(normalizedInput) || jid.includes(normalizedInput);
  });

  if (partial.length === 1) return partial[0];
  return null;
}

async function extractImageDataUrlFromMessage(msg) {
  const imageMessage = msg?.message?.imageMessage
    || msg?.message?.ephemeralMessage?.message?.imageMessage
    || msg?.message?.viewOnceMessage?.message?.imageMessage
    || msg?.message?.viewOnceMessageV2?.message?.imageMessage;

  if (!imageMessage) return "";

  try {
    const stream = await downloadContentFromMessage(imageMessage, "image");
    const chunks = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    const buffer = Buffer.concat(chunks);
    if (!buffer.length) return "";
    const mime = String(imageMessage.mimetype || "image/jpeg").trim() || "image/jpeg";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch (error) {
    console.error("Falha ao extrair imagem no /evento:", error.message);
    return "";
  }
}

function parsePrivateGroupRelayCommand(text) {
  const cleaned = stripCommandMarks(text);
  const numeric = cleaned.match(/^\s*\/bot\s+fala\s+no\s+grupo\s*[:\-]?\s*(\d+)\s+([\s\S]+)$/i);
  if (numeric) {
    return {
      groupIndex: Number(numeric[1]),
      message: String(numeric[2] || "").trim(),
      payload: `${numeric[1]} ${String(numeric[2] || "").trim()}`
    };
  }

  const match = cleaned.match(/^\s*\/bot\s+fala\s+no\s+grupo\s+(.+)$/i);
  if (!match) return null;

  const payload = String(match[1] || "").trim();
  return { payload };
}

function stripCommandMarks(value) {
  return String(value || "")
    .replace(/[\u200b\u200c\u200d\ufeff\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/[\u00a0\u202f]/g, " ")
    .trim();
}

function resolveRelayTarget(groups, payload, senderJid) {
  const raw = String(payload || "").trim();
  if (!raw) return { group: null, message: "" };

  const numericMatch = raw.match(/^(\d+)(?:\s+([\s\S]*))?$/);
  if (numericMatch) {
    const index = Number(numericMatch[1]);
    const message = String(numericMatch[2] || "").trim();
    const cachedGroups = getRememberedPrivateGroupList(senderJid, groups);

    if (Number.isInteger(index) && index >= 1 && index <= cachedGroups.length) {
      return {
        group: cachedGroups[index - 1],
        message
      };
    }
  }

  const lowerPayload = raw.toLowerCase();
  const candidates = [];

  for (const group of groups) {
    const labels = [group.name, group.jid].filter(Boolean);

    for (const label of labels) {
      const normalizedLabel = String(label).trim();
      if (!normalizedLabel) continue;

      const lowerLabel = normalizedLabel.toLowerCase();
      if (lowerPayload === lowerLabel || lowerPayload.startsWith(`${lowerLabel} `)) {
        const message = raw.slice(normalizedLabel.length).trim();
        candidates.push({ group, message, score: normalizedLabel.length });
      }
    }
  }

  if (candidates.length) {
    candidates.sort((a, b) => b.score - a.score);
    return {
      group: candidates[0].group,
      message: candidates[0].message
    };
  }

  const firstSpace = raw.indexOf(" ");
  const query = firstSpace === -1 ? raw : raw.slice(0, firstSpace);
  const fallbackMessage = firstSpace === -1 ? "" : raw.slice(firstSpace + 1).trim();
  const normalizedQuery = normalizeText(query);

  const partial = groups.filter((group) => {
    const name = normalizeText(group.name || "");
    const jid = normalizeText(group.jid || "");
    return name.includes(normalizedQuery) || jid.includes(normalizedQuery);
  });

  if (partial.length === 1) {
    return {
      group: partial[0],
      message: fallbackMessage
    };
  }

  return { group: null, message: "" };
}

function resolveRelayByIndex(groups, groupIndex, message, senderJid) {
  const index = Number(groupIndex);
  const ordered = getRememberedPrivateGroupList(senderJid, groups);

  if (!Number.isInteger(index) || index < 1 || index > ordered.length) {
    return { group: null, message: String(message || "").trim() };
  }

  return {
    group: ordered[index - 1],
    message: String(message || "").trim()
  };
}

function rememberPrivateGroupList(senderJid, groups) {
  if (!senderJid || !Array.isArray(groups)) return;

  privateGroupListCache.set(senderJid, {
    createdAt: Date.now(),
    jids: groups.map((group) => group.jid).filter(Boolean)
  });
}

function getRememberedPrivateGroupList(senderJid, currentGroups) {
  if (!senderJid) return currentGroups;

  const cached = privateGroupListCache.get(senderJid);
  if (!cached) return currentGroups;

  if (Date.now() - cached.createdAt > GROUP_LIST_CACHE_TTL_MS) {
    privateGroupListCache.delete(senderJid);
    return currentGroups;
  }

  const byJid = new Map(currentGroups.map((group) => [group.jid, group]));
  const ordered = cached.jids.map((jid) => byJid.get(jid)).filter(Boolean);

  if (!ordered.length) return currentGroups;
  return ordered;
}

function formatGroupOptions(groups) {
  if (!Array.isArray(groups) || !groups.length) {
    return "Nenhum grupo disponivel no momento.";
  }

  const list = groups
    .slice(0, 20)
    .map((group, index) => `${index + 1}. ${group.name || group.jid}`)
    .join("\n");

  return ["Grupos disponiveis:", list].join("\n");
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getIaSessionKey(jid, senderJid) {
  return `${jid}::${senderJid || "unknown"}`;
}

function hasActiveIaSession(jid, senderJid) {
  if (!jid || !senderJid) return false;

  const key = getIaSessionKey(jid, senderJid);
  const expiresAt = iaSessions.get(key) || 0;

  if (Date.now() > expiresAt) {
    iaSessions.delete(key);
    return false;
  }

  return true;
}

function touchIaSession(jid, senderJid) {
  if (!jid || !senderJid) return;

  const key = getIaSessionKey(jid, senderJid);
  iaSessions.set(key, Date.now() + IA_SESSION_TTL_MS);
}

startBot().catch((error) => {
  console.error("Erro fatal ao iniciar o bot:", error);
  process.exit(1);
});
