import makeWASocket, { DisconnectReason, useSingleFileAuthState, fetchLatestBaileysVersion, makeInMemoryStore } from '@adiwajshing/baileys';
import pino from 'pino';

const { state, saveState } = useSingleFileAuthState('./auth_info_multi.json');
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

async function startBot() {
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state
  });

  store.bind(sock.ev);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) console.log('Escanea este QR con tu WhatsApp:', qr);
    if (connection === 'close') {
      if ((lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut) {
        startBot();
      } else {
        console.log('Desconectado por logout.');
      }
    }
    if (connection === 'open') {
      console.log('Bot conectado correctamente.');
    }
  });

  sock.ev.on('group-participants.update', async (update) => {
    const groupId = update.id;
    for (const participant of update.participants) {
      if (update.action === 'add') {
        const welcomeMsg = `@${participant.split('@')[0]} bienvenido al clan 👻!! XVK espera q seas muy activo‼️. no olvides leer las reglas 😡🥵.`;
        await sock.sendMessage(groupId, { text: welcomeMsg, mentions: [participant] });
      }
      if (update.action === 'remove') {
        const goodbyeMsg = `@${participant.split('@')[0]} no aguantó la presión 👻🥵`;
        await sock.sendMessage(groupId, { text: goodbyeMsg, mentions: [participant] });
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg.message) return;
    if (msg.key.fromMe) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text) return;

    if (text === '!todos') {
      const groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
      const participants = groupMetadata.participants.map(p => p.id);
      await sock.sendMessage(msg.key.remoteJid, { text: '¡Atención a todos!', mentions: participants });
    }
  });
}

startBot();