const mineflayer = require('mineflayer');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

let bot;
let botConnected = false;

function createBot() {
  bot = mineflayer.createBot({
    host: config.serverIp,
    port: config.serverPort,
    version: config.version,
    username: config.botName
  });

  bot.on('login', () => {
    botConnected = true;
    console.log('Bot connected');
  });

  bot.on('message', (jsonMsg) => {
    if (botConnected) {
      io.emit('chat', jsonMsg.toString());
    }
  });

  bot.on('playerJoined', (player) => {
    if (botConnected) {
      io.emit('playerUpdate');
    }
  });

  bot.on('playerLeft', (player) => {
    if (botConnected) {
      io.emit('playerUpdate');
    }
  });

  bot.once('spawn', () => {
    bot.on('physicsTick', () => {
      if (botConnected && bot.entity && bot.entity.position) {
        io.emit('botPosition', bot.entity.position);
      }
    });
  });

  const reconnect = () => {
    botConnected = false;
    console.log('Bot disconnected. Reconnecting in 15 seconds...');
    bot.removeAllListeners();
    setTimeout(createBot, 15000);
  };

  bot.on('end', reconnect);
  bot.on('kicked', (reason) => {
    console.log(`Bot was kicked for ${reason}. Reconnecting in 15 seconds...`);
    reconnect();
  });
  bot.on('error', (err) => {
    console.log(`Bot encountered an error: ${err.message}`);
    reconnect();
  });
}

createBot();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

io.on('connection', (socket) => {
  socket.on('sendMessage', (message) => {
    if (botConnected && bot.chat) bot.chat(message);
  });

  socket.on('getPlayers', () => {
    if (botConnected && bot.players) {
      const players = Object.keys(bot.players);
      socket.emit('playerList', players);
    }
  });

  socket.on('getBotInfo', () => {
    if (botConnected && bot.username && bot.player && bot.player.ping !== undefined) {
      const botInfo = {
        name: bot.username,
        latency: bot.player.ping,
        playerCount: Object.keys(bot.players).length,
        serverIp: config.serverIp,
        serverPort: config.serverPort === 25565 ? '' : `:${config.serverPort}`
      };
      socket.emit('botInfo', botInfo);
    }
  });

  socket.on('getBotPosition', () => {
    if (botConnected && bot.entity && bot.entity.position) {
      socket.emit('botPosition', bot.entity.position);
    }
  });
});

server.listen(3000, () => {
  console.log('Server is running on port 3000');
});
