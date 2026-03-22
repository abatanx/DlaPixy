const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const electronBinary = require('electron');

const projectRoot = path.resolve(__dirname, '..');
const distRoot = path.join(projectRoot, 'dist-electron');
const entryFile = path.join(distRoot, 'electron', 'main.js');
let electronProcess = null;
let isRestarting = false;
let isShuttingDown = false;
let restartTimer = null;
const watchers = new Set();
const watchedDirectories = new Set();

function log(message) {
  process.stdout.write(`[dev-electron] ${message}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForFile(filePath) {
  while (!isShuttingDown) {
    if (fs.existsSync(filePath)) {
      return;
    }
    await sleep(150);
  }
}

function buildElectronEnv() {
  return {
    ...process.env,
    VITE_DEV_SERVER_URL: process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173'
  };
}

function spawnElectron() {
  if (isShuttingDown) {
    return;
  }

  log('Electron を起動するよ');
  electronProcess = spawn(electronBinary, ['.'], {
    cwd: projectRoot,
    env: buildElectronEnv(),
    stdio: 'inherit'
  });

  electronProcess.once('exit', (code) => {
    const shouldRestart = isRestarting;
    electronProcess = null;
    isRestarting = false;

    if (isShuttingDown) {
      return;
    }

    if (shouldRestart) {
      spawnElectron();
      return;
    }

    process.exit(code ?? 0);
  });
}

function requestRestart(reason) {
  if (isShuttingDown) {
    return;
  }

  if (!fs.existsSync(entryFile)) {
    return;
  }

  if (restartTimer) {
    clearTimeout(restartTimer);
  }

  restartTimer = setTimeout(() => {
    restartTimer = null;

    if (isShuttingDown) {
      return;
    }

    if (!electronProcess) {
      spawnElectron();
      return;
    }

    isRestarting = true;
    log(`変更を検知したので再起動するよ: ${reason}`);
    electronProcess.kill();
  }, 180);
}

function watchDirectory(directoryPath) {
  if (watchedDirectories.has(directoryPath) || !fs.existsSync(directoryPath)) {
    return;
  }

  let stats;
  try {
    stats = fs.statSync(directoryPath);
  } catch {
    return;
  }

  if (!stats.isDirectory()) {
    return;
  }

  watchedDirectories.add(directoryPath);

  const watcher = fs.watch(directoryPath, (eventType, fileName) => {
    const name = typeof fileName === 'string' && fileName.length > 0 ? fileName : '.';
    const fullPath = path.join(directoryPath, name);
    const relativePath = path.relative(distRoot, fullPath) || path.basename(directoryPath);

    try {
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
        watchDirectory(fullPath);
      }
    } catch {
      // ignore transient fs state while TypeScript rewrites outputs
    }

    requestRestart(`${eventType}:${relativePath}`);
  });

  watcher.on('error', () => {
    log(`watcher error: ${directoryPath}`);
  });

  watchers.add(watcher);

  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      watchDirectory(path.join(directoryPath, entry.name));
    }
  }
}

function cleanup(exitCode) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }

  for (const watcher of watchers) {
    watcher.close();
  }
  watchers.clear();

  if (!electronProcess) {
    process.exit(exitCode);
    return;
  }

  electronProcess.once('exit', () => {
    process.exit(exitCode);
  });
  electronProcess.kill();
}

process.on('SIGINT', () => cleanup(0));
process.on('SIGTERM', () => cleanup(0));

(async () => {
  log('Electron build の準備を待つよ');
  await waitForFile(entryFile);

  if (isShuttingDown) {
    return;
  }

  watchDirectory(distRoot);
  spawnElectron();
})().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  cleanup(1);
});
