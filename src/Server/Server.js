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
  let started = false;
  if (status === STATUSES.STOPPED) {
    try {
      if (expressApp._router && expressApp._router.stack) {
        expressApp._router.stack.splice(2, expressApp._router.stack.length);
      }

      expressApp.set('view engine', 'ejs');
      status = STATUSES.STARTING;
      StatusBar.startingText();

      // Reload config, checks new projects
      let config = Utils.loadConfig(restarting);
      let { foldersRootMap } = config;

      let watch = Utils.getConfigurationServer('watch');
      if (watch) {
        await LiveServer.start(expressApp, config);
      }

      Object.entries(foldersRootMap).forEach(([key, folderRoot]) => {
        expressApp.use(key, express.static(folderRoot));
      });

      Proxy.resetCache();

      await Proxy.setODataProxy(expressApp, config);
      await Proxy.setResourcesProxy(expressApp, config);
      await Index.setIndexMiddleware(expressApp, config);

      let protocol = Utils.getConfigurationServer('protocol');
      let port = Utils.getConfigurationServer('port');
      if (protocol === 'https') {
        let { cert } = config;
        server = https.createServer(cert, expressApp).listen(port, () => {
          serverReady(restarting);
        });
      } else {
        server = http.createServer(expressApp).listen(port, () => {
          serverReady(restarting);
        });
      }

      server.timeout = 30 * 1000;
      started = true;
    } catch (e) {
      status = STATUSES.STOPPING;
      StatusBar.stoppingText();
      throw new Error(e);
    }
  }
  return started;
}

function serverReady(restarting = false) {
  let protocol = Utils.getConfigurationServer('protocol');
  let port = Utils.getConfigurationServer('port');
  let open = Utils.getConfigurationServer('open');

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

async function stop() {
  let stopped = false;
  if (status === STATUSES.STARTED) {
    status = STATUSES.STOPPING;
    StatusBar.stoppingText();

    await Promise.all([stopServer(), LiveServer.stop()]);

    status = STATUSES.STOPPED;
    StatusBar.startText();
    stopped = true;
  }
  return stopped;
}

async function restart() {
  let restarted = false;
  if (status === STATUSES.STARTED) {
    await stop();
    await start(true);
    restarted = true;
  }
  return restarted;
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
  return true;
}

export default {
  start,
  stop,
  restart,
  toggle,
};
