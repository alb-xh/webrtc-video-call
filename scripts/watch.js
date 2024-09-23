const { watch } = require('node:fs');
const { resolve } = require('node:path');
const { exec } = require('node:child_process');
const process = require('node:process');

const run = (command, { process } = {}) => {
  const cp = exec(command);
  if (process) {
    cp.stdin.pipe(process.stdin);
    cp.stdout.pipe(process.stdout);
    cp.stderr.pipe(process.stderr);
  }
};

const bundleClient = () => run(`npx webpack`);
const watchServer = (entry) => run(`tsx watch ${entry}`, { process });

const clientDir = resolve(__dirname, '../src/client');
const serverEntryFile = resolve(__dirname, '../src/server/index.ts');

const main = () => {
  bundleClient();
  watch(clientDir, () => bundleClient());
  watchServer(serverEntryFile);
}

main();
