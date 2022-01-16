import connectLiveReload, { FileMatcher } from 'connect-livereload';
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';

import Utils from '../Utils/Utils';
import Config from '../Utils/Config';
import Log from '../Utils/Log';
import { ServerOptions } from '../Types/Types';
import { NextFunction, Request, Response } from 'express';

const DELAY_REFRESH = 500;
let liveServer: http.Server | https.Server | undefined;
let liveServerWS: WebSocketServer | undefined;
let timeout: ReturnType<typeof setTimeout>;

export default {
  liveServerWS: undefined,
  liveServer: undefined,

  async start(oConfigParams: ServerOptions): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        Log.server('LiveServer > Starting...');
        this.middleware(oConfigParams);
        await this.createServer(oConfigParams);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  },

  async createServer(oConfigParams: ServerOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const { portLiveReload } = oConfigParams;
        const protocol = Config.server('protocol');

        if (protocol === 'http') {
          //@ts-ignore
          liveServer = http.createServer(this.serveLiveReloadScript);
        } else {
          //@ts-ignore
          liveServer = https.createServer(Utils.getHttpsCert(), this.serveLiveReloadScript);
        }
        liveServer.listen(portLiveReload);

        liveServerWS = new WebSocketServer({
          server: liveServer,
        });
        liveServerWS.on('connection', (ws) => this.onConnection(ws));
        liveServerWS.on('close', () => this.onClose());
        liveServerWS.on('error', (error) => this.onError(error.message));

        liveServerWS.once('listening', () => {
          Log.server('LiveServer > Started!');
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  onConnection(ws: WebSocket): WebSocket {
    this.debug('Browser connected');
    ws.on(
      'message',
      ((ws) => {
        return (data: string) => {
          this.debug('Client message: ' + data);
          const request = JSON.parse(data);
          if (request.command === 'hello') {
            this.debug('Client requested handshake...');
            const data = JSON.stringify({
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
    return ws.on('close', () => {
      return this.debug('Client closed connection');
    });
  },

  onClose(): void {
    this.debug('WebSocket closed');
  },

  onError(error: string): void {
    this.debug(`Error: + ${error}`);
  },

  serveLiveReloadScript(req: Request, res: Response, next: NextFunction): void {
    if (req.url.indexOf('/livereload.js') === 0) {
      res.writeHead(200, {
        'Content-Type': 'text/javascript',
      });
      res.end(fs.readFileSync(path.join(Utils.getExtensionFsPath(), 'static', 'scripts', 'livereload.js')));
    }
    next();
  },

  middleware({ serverApp, portLiveReload }: ServerOptions): void {
    // let include = [];

    // ui5Apps.forEach((ui5App) => {
    //   include.push(new RegExp(`^${ui5App.appServerPath}(.*)`, 'g'));
    // });
    // Include only workspace projects
    const aIgnore: FileMatcher[] = [
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

    const odataMountPath = String(Config.server('odataMountPath'));
    const mpaths = odataMountPath.replace(/\\s/g, '').split(',');
    mpaths.forEach((path) => {
      const re = new RegExp(`^${path}`, 'g');
      aIgnore.push(re);
    });

    const connLiveReload: any = connectLiveReload({
      port: portLiveReload,
      ignore: aIgnore,
    });
    serverApp.use(connLiveReload);
  },

  refresh(sFilePath: string): void {
    if (liveServerWS) {
      const data = JSON.stringify({
        command: 'reload',
        path: sFilePath,
        liveCSS: true,
        liveImg: true,
        originalPath: '',
        overrideURL: '',
      });
      Log.server(`File change detected: ${sFilePath}`);
      this.sendAllClients(data);
    }
  },

  sendAllClients(data: string): void {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      liveServerWS?.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          Log.server('Refreshing browser...');
          this.debug('Sending: ' + data);

          ws.send(data, (error) => {
            if (error) {
              this.debug(error.message);
            }
          });
        }
      });
    }, DELAY_REFRESH);
  },

  async stop(): Promise<void> {
    if (liveServerWS) {
      liveServerWS.clients.forEach((ws) => {
        ws.terminate();
      });
      liveServerWS.close();
      liveServerWS = undefined;
    }
    if (liveServer) {
      Log.server('LiveServer > Stopping...');
      liveServer.close();
      liveServer = undefined;
      Log.server('LiveServer > Stopped!');
    }
  },

  debug(message: string): string {
    console.log(message);
    return message;
  },
};
