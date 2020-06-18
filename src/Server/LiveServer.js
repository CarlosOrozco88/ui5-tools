import connectLiveReload from 'connect-livereload';
import fs from 'fs';
import url from 'url';
import http from 'http';
import https from 'https';
import path from 'path';
import WebSocket from 'ws';
import portfinder from 'portfinder';
import chokidar from 'chokidar';

import Utils from '../Utils/Utils';
import Config from '../Utils/Config';
import Server from './Server';

export default {
  liveServerWS: undefined,
  liveServer: undefined,
  watching: undefined,

  async start(serverApp, ui5Apps) {
    return new Promise(async (resolv, reject) => {
      try {
        let portLiveReload = await portfinder.getPortPromise({
          port: 35729,
        });
        this.middleware({ serverApp, portLiveReload, ui5Apps });
        await this.createServer(portLiveReload);
        resolv();
      } catch (error) {
        reject(error);
      }
    });
  },

  async createServer(portLiveReload) {
    return new Promise((resolv, reject) => {
      try {
        let protocol = Config.server('protocol');

        if (protocol === 'http') {
          this.liveServer = http.createServer(this.serveLiveReloadScript);
        } else {
          this.liveServer = https.createServer(Utils.getHttpsCert(), this.serveLiveReloadScript);
        }
        this.liveServer.listen(portLiveReload);

        this.liveServerWS = new WebSocket.Server({
          server: this.liveServer,
        });
        this.liveServerWS.on('connection', (ws) => this.onConnection(ws));
        this.liveServerWS.on('close', (ws) => this.onClose(ws));
        this.liveServerWS.on('error', (error) => this.onError(error));

        this.liveServerWS.once('listening', () => {
          resolv();
        });

        this.watch();
      } catch (error) {
        reject(error);
      }
    });
  },

  onConnection(ws) {
    this.debug('Browser connected');
    ws.on(
      'message',
      ((ws) => {
        return (data) => {
          this.debug('Client message: ' + data);
          let request = JSON.parse(data);
          if (request.command === 'hello') {
            this.debug('Client requested handshake...');
            let data = JSON.stringify({
              command: 'hello',
              protocols: [
                'http://livereload.com/protocols/official-7',
                'http://livereload.com/protocols/official-8',
                'http://livereload.com/protocols/official-9',
                'http://livereload.com/protocols/2.x-origin-version-negotiation',
                'http://livereload.com/protocols/2.x-remote-control',
              ],
              serverName: 'node-livereload',
            });
            ws.send(data);
          }
          if (request.command === 'info') {
            return this.debug('Server received client data. Not sending response.');
          }
        };
      })(ws)
    );
    ws.on('error', (error) => {
      return this.debug('Error in client: ' + error);
    });
    return ws.on('close', (ws) => {
      return this.debug('Client closed connection');
    });
  },

  onError(error) {
    return this.debug('Error:' + error);
  },

  onClose(ws) {
    return this.debug('WebSocket closed');
  },

  serveLiveReloadScript(req, res) {
    if (url.parse(req.url).pathname === '/livereload.js') {
      res.writeHead(200, {
        'Content-Type': 'text/javascript',
      });
      return res.end(fs.readFileSync(path.join(Utils.getUi5ToolsPath(), 'static', 'scripts', 'livereload.js')));
    }
  },

  middleware({ serverApp = undefined, portLiveReload = 35729, ui5Apps = [] } = {}) {
    let include = [];

    ui5Apps.forEach((ui5App) => {
      include.push(new RegExp(`^${ui5App.appServerPath}(.*)`, 'g'));
    });
    // Include only workspace projects
    let ignore = [
      /\.js(\?.*)?$/,
      /\.css(\?.*)?$/,
      /\.svg(\?.*)?$/,
      /\.ico(\?.*)?$/,
      /\.woff(\?.*)?$/,
      /\.png(\?.*)?$/,
      /\.jpg(\?.*)?$/,
      /\.jpeg(\?.*)?$/,
      /\.gif(\?.*)?$/,
      /\.pdf(\?.*)?$/,
      /^\/sap\/(.*)/,
      /(.*)\/resources\/(.*)/,
    ];
    let odataM;
    let odataMountPath = Config.server('odataMountPath');
    let mpaths = odataMountPath.replace(/\\s/g).split(',');
    mpaths.forEach((path) => {
      let re = new RegExp(`^${path}`, 'g');
      ignore.push(re);
    });

    serverApp.use(
      connectLiveReload({
        port: portLiveReload,
        ignore: ignore,
      })
    );
  },

  async watch() {
    let ui5Apps = await Utils.getAllUI5Apps();
    let paths = ui5Apps.map((ui5App) => {
      let path;
      if (Server.serverMode === Server.SERVER_MODES.DEV) {
        path = ui5App.srcFsPath;
      } else {
        path = ui5App.distFsPath;
      }
      return path;
    });
    this.watching = chokidar.watch(paths, {
      ignoreInitial: true,
      ignored: [/\.git\//, /\.svn\//, /\.hg\//, /\.node_modules\//],
      usePolling: false,
    });
    this.watching.on('add', (filePath) => this.checkRefresh(filePath));
    this.watching.on('change', (filePath) => this.checkRefresh(filePath));
    this.watching.on('unlink', (filePath) => this.checkRefresh(filePath));
  },

  checkRefresh(filePath) {
    let watchExtensions = Config.server('watchExtensions').replace(/\\s/g, '');
    let watchExtensionsArray = watchExtensions.split(',');
    let fileExtension = path.extname(filePath).replace('.', '');
    if (watchExtensionsArray.includes(fileExtension)) {
      this.refresh(filePath);
    }
  },

  refresh(filePath) {
    let data = JSON.stringify({
      command: 'reload',
      path: filePath,
      liveCSS: true,
      liveImg: true,
      originalPath: '',
      overrideURL: '',
    });
    this.sendAllClients(data);
  },

  sendAllClients(data) {
    if (this.liveServerWS) {
      this.liveServerWS.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          this.debug('Sending: ' + data);
          client.send(data, (error) => {
            if (error) {
              this.debug(error);
            }
          });
        }
      });
    }
  },

  async stop() {
    let stopped = false;
    if (this.liveServerWS) {
      this.watching.unwatch('*');
      this.watching = undefined;
      this.liveServer.close();
      this.liveServer = undefined;
      this.liveServerWS.close();
      this.liveServerWS = undefined;
      stopped = true;
    }
    return stopped;
  },

  debug(message) {
    console.log(message);
    return message;
  },
};
