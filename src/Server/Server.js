import express from 'express';
import opn from 'opn';
import http from 'http';
import https from 'https';

import LiveServer from './LiveServer';
import StatusBar from '../StatusBar/StatusBar';
import Utils from '../Utils/Utils';
import Proxy from './Proxy';
import Index from './Index';

const expressApp = express();
// @ts-ignore
expressApp.engine('ejs', require('ejs').__express);
let server;
let status = 0;
const STATUSES = {
  STOPPED: 0,
  STARTING: 1,
  STARTED: 2,
  STOPPING: 3,
};

async function start(restarting = false) {
  try {
    if (status != STATUSES.STOPPED) {
      return;
    }
    if (expressApp._router && expressApp._router.stack) {
      expressApp._router.stack.splice(2, expressApp._router.stack.length);
    }

    expressApp.set('view engine', 'ejs');
    status = STATUSES.STARTING;
    StatusBar.startingText();

    // Reload config, checks new projects
    let config = Utils.loadConfig(restarting);
    let { foldersRootMap, port, watch, protocol, folders, cert } = config;

    if (watch) {
      await LiveServer.start(expressApp, config);
    }

    Object.entries(foldersRootMap).forEach(([key, folderRoot]) => {
      expressApp.use(key, express.static(folderRoot));
    });

    await Proxy.setGatewayProxy(expressApp);
    await Proxy.setResourcesProxy(expressApp, folders);
    await Index.setIndexMiddleware(expressApp, config);

    if (protocol == 'https') {
      server = https.createServer(cert, expressApp).listen(port, () => {
        serverReady(config, restarting);
      });
    } else {
      server = http.createServer(expressApp).listen(port, () => {
        serverReady(config, restarting);
      });
    }

    server.timeout = 30 * 1000;
  } catch (e) {
    throw new Error(e);
  }
}

function serverReady({ open, folders, index, port, protocol }, restarting = false) {
  status = STATUSES.STARTED;
  StatusBar.stopText();

  if (open && !restarting) {
    opn(`${protocol}://localhost:${port}`);
  }
}

function stopServer() {
  return new Promise((resolv, reject) => {
    if (server && server.listening) {
      server.close(() => {
        //server.unref();
        resolv();
      });
    } else {
      resolv();
    }
  });
}

function stop() {
  if (status != STATUSES.STARTED) {
    return Promise.resolve();
  }
  status = STATUSES.STOPPING;
  StatusBar.stoppingText();

  return Promise.all([stopServer(), LiveServer.stop()]).then(() => {
    status = STATUSES.STOPPED;
    StatusBar.startText();
  });
}

async function restart() {
  await stop();
  await start(true);
}

async function toggle() {
  switch (status) {
    case STATUSES.STOPPED:
      await start();
      break;
    case STATUSES.STARTED:
      await stop();
      break;
  }
  return;
}

export default {
  start,
  stop,
  restart,
  toggle,
};
