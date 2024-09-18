import path from 'node:path';
import http from 'node:http';

import express from 'express';
import cors from 'cors';
import logger from 'loglevel';

import { Server } from 'socket.io';

import { isProd } from './helpers';
import { URL, PORT } from './constants';

logger.setLevel(isProd() ? 'INFO' : 'DEBUG');

const app = express();

app.use(
  cors({ origin: URL }),
  express.static(path.resolve(__dirname, '../public'))
);

const server = http.createServer(app);
const io = new Server(server);

io.on('connection', (socket) => {
  logger.debug(`Connection established: ${socket.id}`);

  socket.on('disconnect', (reason) => {
    logger.debug(`Connection disconnected: ${socket.id}: ${reason}`);
  });
});


server.listen(PORT, () => {
  console.log(`Listening on: ${URL}`);
});
