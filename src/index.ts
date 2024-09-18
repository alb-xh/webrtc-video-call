import path from 'node:path';

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

const PORT = 3000;
const URL = `http://localhost:${PORT}`;

const app = express();

app.use(
  helmet(),
  cors({ origin: URL }),
  express.static(path.resolve(__dirname, '../public'))
);

app.listen(PORT, () => {
  console.log(`Listening on: ${URL}`);
});
