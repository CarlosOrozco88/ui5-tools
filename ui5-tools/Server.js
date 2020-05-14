const express = require('express');
const { workspace, window } = require('vscode');
const liveReload = require('livereload');
const connectLiveReload = require('connect-livereload');
const opn = require('opn');
const { createProxyMiddleware } = require('http-proxy-middleware');
const httpsModule = require('https');
const path = require('path');
const fs = require('fs');
const urljoin = require('url-join');

const StatusBar = require('./StatusBar');
const Utils = require('./Utils');

let app, server, liveServer;

async function start(restarting = false) {
  try {
    StatusBar.startingText();

    let config = Utils.loadConfig(restarting);
    let { foldersRootMap, folders, port, watch, baseDir, open, index, protocol } = config;

    app = express();

    app.use('/index.html', express.static(path.join(baseDir, 'index.html')));

    if (watch) {
      attachLiveReload(app, config);
    }

    Object.entries(foldersRootMap).forEach(([key, folderRoot]) => {
      app.use(key, express.static(folderRoot));
    });

    await getGatewayProxy(app, folders);
    await getResourcesProxy(app, folders);
    await getErrorsMiddleware(app);

    if (protocol == 'https') {
      server = httpsModule
        .createServer(
          {
            key: fs.readFileSync(path.join(__dirname, 'cert', 'server.key')),
            cert: fs.readFileSync(path.join(__dirname, 'cert', 'server.cert')),
          },
          app
        )
        .listen(port, () => {
          listen(open, restarting, folders, index, port, protocol);
        });
    } else {
      server = app.listen(port, () => {
        listen(open, restarting, folders, index, port, protocol);
      });
    }
  } catch (e) {
    throw new Error(e);
  }
}

function listen(open, restarting, folders, index, port, protocol) {
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
  StatusBar.stoppingText();
  return new Promise((resolv) => {
    server.close(() => {
      app = undefined;
      server = undefined;
      StatusBar.startText();
      resolv();
    });
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

function attachLiveReload(app, { foldersRoot, portLiveReload }) {
  liveServer = liveReload.createServer({
    extraExts: 'xml,json,properties',
    watchDirs: foldersRoot,
    app: app,
    port: portLiveReload,
  });
  liveServer.watch(foldersRoot);

  app.use(
    connectLiveReload({
      ignore: [],
      port: portLiveReload,
    })
  );
}

async function getGatewayProxy(app, folders = []) {
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
      break;

    case 'CDN SAPUI5':
    case 'CDN OpenUI5':
      let framework = resourcesProxy.indexOf('SAPUI5') >= 0 ? 'sapui5' : 'openui5';
      let ui5Version = Utils.getConfigurationGeneral('ui5Version');

      targetUri = `https://${framework}.hana.ondemand.com/${ui5Version}/`;
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

      httpsModule
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

async function getErrorsMiddleware(app) {
  app.use(function (req, res) {
    res.status(404).send(Utils.get404());
  });
  return;
}

module.exports = {
  start,
  stop,
  restart,
  toggle,
  get,
};
