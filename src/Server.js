import express from 'express';
import { workspace, window } from 'vscode';
import liveReload from 'livereload';
import connectLiveReload from 'connect-livereload';
import opn from 'opn';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import fs from 'fs';
import urljoin from 'url-join';
import url from 'url';
import http from 'http';
import https from 'https';

import StatusBar from './StatusBar';
import Utils from './Utils';
import Index from './Index';

let app, server, appLiveServer;
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
    status = STATUSES.STARTING;
    StatusBar.startingText();

    let config = Utils.loadConfig(restarting);
    let { foldersRootMap, port, watch, protocol, folders, baseDir, cert } = config;

    app = express();

    if (watch) {
      await attachLiveReload(app, config);
    }

    Object.entries(foldersRootMap).forEach(([key, folderRoot]) => {
      app.use(key, express.static(folderRoot));
    });

    await getGatewayProxy(app);
    await getResourcesProxy(app, folders);
    await getIndexMiddleware(app, config);

    if (protocol == 'https') {
      server = https.createServer(cert, app).listen(port, () => {
        serverReady(config, restarting);
      });
    } else {
      server = http.createServer(app).listen(port, () => {
        serverReady(config, restarting);
      });
    }
  } catch (e) {
    throw new Error(e);
  }
}

function serverReady({ open, folders, index, port, protocol }, restarting = false) {
  status = STATUSES.STARTED;
  StatusBar.stopText();

  if (open && !restarting) {
    let route = '';
    if (folders.length == 1) {
      route = folders[0];
    }
    let url = urljoin(`${protocol}://localhost:${port}`, route, index);
    opn(url);
  }
}

function stop() {
  if (status != STATUSES.STARTED) {
    return Promise.resolve();
  }
  status = STATUSES.STOPPING;
  StatusBar.stoppingText();

  let stopServer = new Promise((resolv, reject) => {
    if (server) {
      server.close(() => {
        //server.unref();
        server = undefined;
        app = undefined;
        resolv();
      });
    } else {
      resolv();
    }
  });
  let stopLiveServer = new Promise((resolv, reject) => {
    if (appLiveServer) {
      // appLiveServer.server.on('close', () => {
      //   resolv();
      // });
      appLiveServer.close();
      resolv();
    } else {
      resolv();
    }
  });

  return Promise.all([stopServer, stopLiveServer]).then(() => {
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

function attachLiveReload(app, { foldersRoot, portLiveReload, watchExtensions, protocol, cert, lrPath }) {
  return new Promise(function (resolv, reject) {
    try {
      if (!appLiveServer) {
        let requestHandler = function (req, res) {
          if (url.parse(req.url).pathname === '/livereload.js') {
            res.writeHead(200, {
              'Content-Type': 'text/javascript',
            });
            return res.end(fs.readFileSync(lrPath, 'utf-8'));
          }
        };

        let appLiveReload;
        if (protocol === 'http') {
          appLiveReload = http.createServer(requestHandler);
        } else {
          appLiveReload = https.createServer(cert, requestHandler);
        }

        let configLiveServer = {
          extraExts: 'xml,json,properties',
          exts: watchExtensions,
          port: portLiveReload,
          server: appLiveReload,
          noListen: true,
        };

        appLiveServer = liveReload.createServer(configLiveServer);
      }
      appLiveServer.watch(foldersRoot);
      appLiveServer.listen(() => {
        resolv();
      });

      app.use(
        connectLiveReload({
          ignore: [],
          port: portLiveReload,
        })
      );
    } catch (e) {
      reject(e);
    }
  });
}

async function getGatewayProxy(app) {
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
      app.use('/sap', proxy);
      break;

    default:
      break;
  }
  return;
}

async function getResourcesProxy(app, folders = []) {
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

        app.use('/**/resources/**', proxy);
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

        app.use('/**/resources/**', proxy);
      }

      https
        .get(`${targetUri}resources/sap-ui-core.js`, ({ statusCode }) => {
          if (statusCode !== 200) {
            let error = `Error: Unable to get sap-ui-core.js, framework ${framework} does not have ${ui5Version} available at CDN.`;
            StatusBar.pushError(error);
            window.showErrorMessage(error);
          }
        })
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

async function getIndexMiddleware(app, config) {
  app.get('/', function (req, res) {
    res.send(Index.getHTML(config));
  });
  app.get('/index.html', function (req, res) {
    res.send(Index.getHTML(config));
  });
}

export default {
  start,
  stop,
  restart,
  toggle,
  get,
};
