import express from 'express';
import { window } from 'vscode';
import opn from 'opn';
import { createProxyMiddleware } from 'http-proxy-middleware';
import http from 'http';
import https from 'https';
import path from 'path';

import LiveServer from './LiveServer';
import StatusBar from './StatusBar';
import Utils from './Utils';

import Index from './Index';

const expressApp = express();
let server;
let status = 0;
let STATUSES = {
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

    await getGatewayProxy(expressApp);
    await getResourcesProxy(expressApp, folders);
    await getIndexMiddleware(expressApp, config);

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

function stop() {
  if (status != STATUSES.STARTED) {
    return Promise.resolve();
  }
  status = STATUSES.STOPPING;
  StatusBar.stoppingText();

  let stopServer = new Promise((resolv, reject) => {
    if (server && server.listening) {
      server.close(() => {
        //server.unref();
        resolv();
      });
    } else {
      resolv();
    }
  });

  return Promise.all([stopServer, LiveServer.stop()]).then(() => {
    status = STATUSES.STOPPED;
    StatusBar.startText();
  });
}

function get() {
  return server;
}

async function restart() {
  await stop();
  await start(true);
}

async function toggle() {
  if (!server || !server.listening) {
    await start();
  } else {
    await stop();
  }
  return;
}

async function getGatewayProxy(expressApp) {
  let proxy, targetUri;
  let gatewayProxy = Utils.getConfigurationServer('gatewayProxy');
  // Options: Gateway, None
  switch (gatewayProxy) {
    case 'Gateway':
      targetUri = Utils.getConfigurationServer('gatewayUri');
      proxy = createProxyMiddleware({
        pathRewrite: {},
        target: targetUri,
        secure: targetUri.indexOf('https') == 0,
        changeOrigin: true,
        logLevel: 'debug',
      });
      expressApp.use('/sap', proxy);
      break;

    default:
      break;
  }
  return;
}

async function getResourcesProxy(expressApp, folders = []) {
  let targetUri, pathRewrite, pathRoute, proxy;
  let resourcesProxy = Utils.getConfigurationServer('resourcesProxy');

  // Options: Gateway, CDN SAPUI5, CDN OpenUI5, None
  switch (resourcesProxy) {
    case 'Gateway':
      targetUri = Utils.getConfigurationServer('gatewayUri');

      if (targetUri) {
        pathRoute = '/sap/bc/ui5_ui5/sap';

        pathRewrite = {
          '^/': `${pathRoute}/`,
        };

        proxy = createProxyMiddleware({
          pathRewrite,
          target: targetUri,
          secure: targetUri.indexOf('https') == 0,
          changeOrigin: true,
          logLevel: 'debug',
        });

        expressApp.use('/**/resources/**', proxy);
        expressApp.use('/resources/**', proxy);
      }
      break;

    case 'CDN SAPUI5':
    case 'CDN OpenUI5':
      let framework = resourcesProxy.indexOf('SAPUI5') >= 0 ? 'sapui5' : 'openui5';
      let ui5Version = Utils.getConfigurationGeneral('ui5Version');

      targetUri = `https://${framework}.hana.ondemand.com/${ui5Version}/`;

      if (ui5Version) {
        pathRoute = '/';

        pathRewrite = {};
        folders.forEach((folder) => {
          pathRewrite[`^/${folder}/`] = pathRoute;
        });

        proxy = createProxyMiddleware({
          pathRewrite,
          target: targetUri,
          secure: targetUri.indexOf('https') == 0,
          changeOrigin: true,
          logLevel: 'debug',
        });

        expressApp.use('/**/resources/**', proxy);
        expressApp.use('/resources/**', proxy);
      }

      https
        .get(
          `${targetUri}resources/sap-ui-core.js`,
          {
            timeout: 1000 * 5, // 3 seconds to check if ui5 is available
          },
          ({ statusCode }) => {
            if (statusCode !== 200) {
              let error = `Error: Unable to get sap-ui-core.js, framework ${framework} does not have ${ui5Version} available at CDN.`;
              StatusBar.pushError(error);
              window.showErrorMessage(error);
            }
          }
        )
        .on('error', (e) => {
          let error = `Error: Unable to get sap-ui-core.js, framework ${framework} does not have ${ui5Version} available at CDN.`;
          StatusBar.pushError(error);
          window.showErrorMessage(error);
        });

    default:
      break;
  }
  return;
}

async function getIndexMiddleware(expressApp, { ui5ToolsPath, folders, serverName }) {
  expressApp.use('/', express.static(path.join(ui5ToolsPath, 'index', 'ui5', 'webapp')));
  expressApp.get('/ui5tools.json', function (req, res) {
    let appData = {
      folders: folders,
      serverName: serverName,
    };
    res.send(JSON.stringify(appData));
  });

  /*
  expressApp.get('/', function (req, res) {
    res.send(Index.getHTML(config));
  });
  expressApp.get('/index.html', function (req, res) {
    res.send(Index.getHTML(config));
  });
  */
}

export default {
  start,
  stop,
  restart,
  toggle,
  get,
};
