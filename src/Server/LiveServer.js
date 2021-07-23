import connectLiveReload from 'connect-livereload';
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import WebSocket from 'ws';

import Utils from '../Utils/Utils';
import Config from '../Utils/Config';

const DELAY_REFRESH = 500;

export default {
  liveServerWS: undefined,
  liveServer: undefined,

  async start(oConfigParams) {
    return new Promise(async (resolve, reject) => {
      try {
        Utils.logOutputServer('LiveServer > Starting...');
        this.middleware(oConfigParams);
        if (!oConfigParams.restarting) {
          await this.createServer(oConfigParams);
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  },

  async createServer(oConfigParams) {
    return new Promise((resolve, reject) => {
      try {
        let { portLiveReload } = oConfigParams;
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
          Utils.logOutputServer('LiveServer > Started!');
          resolve();
        });
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
    if (req.url.indexOf('/livereload.js') === 0) {
      res.writeHead(200, {
        'Content-Type': 'text/javascript',
      });
      return res.end(fs.readFileSync(path.join(Utils.getUi5ToolsPath(), 'static', 'scripts', 'livereload.js')));
    }
  },

  middleware({ serverApp = undefined, portLiveReload = 35729, ui5Apps = [] } = {}) {
    // let include = [];

    // ui5Apps.forEach((ui5App) => {
    //   include.push(new RegExp(`^${ui5App.appServerPath}(.*)`, 'g'));
    // });
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

  refresh(sFilePath) {
    let data = JSON.stringify({
      command: 'reload',
      path: sFilePath,
      liveCSS: true,
      liveImg: true,
      originalPath: '',
      overrideURL: '',
    });
    this.sendAllClients(data);
  },

  sendAllClients(data) {
    if (this.liveServerWS) {
      clearTimeout(this._sendAllClientsTimeout);
      this._sendAllClientsTimeout = setTimeout(() => {
        Utils.logOutputServer('Refreshing browser...');
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
      }, DELAY_REFRESH);
    }
  },

  async stop() {
    if (this.liveServerWS) {
      Utils.logOutputServer('LiveServer > Stopping...');
      this.liveServer.close();
      this.liveServer = undefined;
      this.liveServerWS.close();
      this.liveServerWS = undefined;
      Utils.logOutputServer('LiveServer > Stopped!');
    }
  },

  debug(message) {
    console.log(message);
    return message;
  },
};
