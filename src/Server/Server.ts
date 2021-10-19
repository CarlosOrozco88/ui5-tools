import express from 'express';
// @ts-ignore
import expressTimeout from 'express-timeout-handler';

import open from 'open';
import http from 'http';
import https from 'https';
import portfinder from 'portfinder';

import Apps from './Apps';
import LiveServer from './LiveServer';
import StatusBar from '../StatusBar/StatusBar';
import Utils from '../Utils/Utils';
import Log from '../Utils/Log';
import Config from '../Utils/Config';
import OdataProxy from './Proxy/Odata';
import ResourcesProxy from './Proxy/Resources';
import IndexUI5Tools from './Index/UI5Tools';
import IndexLaunchpad from './Index/Launchpad';
import ejs from 'ejs';
import { createHttpTerminator } from 'http-terminator';
import { ServerParameter, ServerOptions, ServerMode, ServerStatus, Protocols, Level } from '../Types/Types';

let serverApp: express.Express;
let server: https.Server | http.Server;
let status: ServerStatus = ServerStatus.STOPPED;
let serverMode: ServerMode = ServerMode.DEV;

export default {
  async startDevelopment(oParameters?: ServerParameter): Promise<void> {
    await this.stopAll();

    serverMode = ServerMode.DEV;
    try {
      await this.start(oParameters);
    } catch (e) {
      this.stopAll();
    }
    return;
  },

  /**
   * Starts server in production mode (serving distFolder)
   * @param {object} object params
   */
  async startProduction(oParameters?: ServerParameter): Promise<void> {
    await this.stopAll();

    serverMode = ServerMode.PROD;
    try {
      await this.start(oParameters);
    } catch (e) {
      this.stopAll();
    }
    return;
  },

  /**
   * Start server
   * @param {object} object params
   */
  async start(oParameters?: ServerParameter): Promise<void> {
    if (status === ServerStatus.STOPPED) {
      if (oParameters?.restarting) {
        await StatusBar.checkVisibility();
      }
      ResourcesProxy.resetCache();

      Log.server('Starting...');
      try {
        serverApp = express();
        serverApp.set('view engine', 'ejs');
        serverApp.disable('x-powered-by');

        serverApp.engine('ejs', ejs.renderFile);

        status = ServerStatus.STARTING;
        StatusBar.startingText();

        // Reload config, checks new projects
        const bServeProduction = serverMode === ServerMode.PROD;
        const sServerMode = bServeProduction ? ServerMode.PROD : ServerMode.DEV;
        const ui5Apps = await Utils.getAllUI5Apps();
        const protocol = Config.server('protocol') as keyof typeof Protocols;
        const oConfigParams: ServerOptions = {
          serverApp: serverApp,
          ui5Apps: ui5Apps,
          bServeProduction: bServeProduction,
          sServerMode: sServerMode,
          watch: Boolean(Config.server('watch')),
          protocol: Protocols[protocol],
          port: await portfinder.getPortPromise({
            port: Number(Config.server('port')),
          }),
          portLiveReload: await portfinder.getPortPromise({
            port: 35729,
          }),
          timeout: Number(Config.server('timeout')),
          baseDir: Utils.getWorkspaceRootPath(),
          ui5ToolsPath: Utils.getExtensionFsPath(),
          ui5ToolsIndex: Utils.getUi5ToolsIndexFolder(),
          isLaunchpadMounted: Utils.isLaunchpadMounted(),
          bCacheBuster: Config.server('cacheBuster') === sServerMode,
          restarting: Boolean(oParameters?.restarting),
        };

        if (oConfigParams.timeout) {
          serverApp.use(
            expressTimeout.handler({
              timeout: oConfigParams.timeout,
              onTimeout(req: any, res: any) {
                const message = Log.server('UI5 Tools server timeout', Level.ERROR);
                res.status(503).send(message);
              },
              onDelayedResponse(req: any, method: any, args: any, requestTime: any) {
                Log.server('Attempted to call ${method} after timeout', Level.ERROR);
              },
            })
          );
        }

        if (oConfigParams.watch) {
          try {
            await LiveServer.start(oConfigParams);
          } catch (oError) {
            Log.server(oError, Level.ERROR);
          }
        }

        Apps.serve(oConfigParams);

        try {
          await OdataProxy.set(oConfigParams);
        } catch (oError) {
          Log.server(oError, Level.ERROR);
        }
        try {
          await ResourcesProxy.set(oConfigParams);
        } catch (oError) {
          Log.server(oError, Level.ERROR);
        }

        try {
          await IndexUI5Tools.set(oConfigParams);
        } catch (oError) {
          Log.server(oError, Level.ERROR);
        }
        try {
          await IndexLaunchpad.set(oConfigParams);
        } catch (oError) {
          Log.server(oError, Level.ERROR);
        }

        if (oConfigParams.protocol === 'https') {
          server = https.createServer(Utils.getHttpsCert(), serverApp);
        } else {
          server = http.createServer(serverApp);
        }

        server.listen(oConfigParams.port, () => {
          Log.server('Started!');
          const openBrowser = Config.server('openBrowser');
          const ui5ToolsIndex = Utils.getUi5ToolsIndexFolder();

          if (openBrowser && !oConfigParams.restarting) {
            open(`${oConfigParams.protocol}://localhost:${oConfigParams.port}/${ui5ToolsIndex}/`);
          }
        });

        status = ServerStatus.STARTED;
        StatusBar.stopText(oConfigParams.port);
      } catch (e: any) {
        this.stopAll();
        throw new Error(e);
      }
    } else {
      const sMessage = Log.server('Error during server startup');
      throw new Error(sMessage);
    }
  },

  async stopServer(): Promise<void> {
    if (server && server.listening) {
      Log.server('Stopping...');

      const httpTerminator = createHttpTerminator({
        server,
      });
      httpTerminator.terminate();
      Log.server('Stopped!');
    }
    return;
  },

  async stop() {
    if (status === ServerStatus.STARTED) {
      status = ServerStatus.STOPPING;
      StatusBar.stoppingText();

      await this.stopServer();

      status = ServerStatus.STOPPED;
      StatusBar.startText();
    }
  },

  async stopAll() {
    if (status === ServerStatus.STARTED) {
      status = ServerStatus.STOPPING;
      StatusBar.stoppingText();

      await Promise.all([this.stopServer(), LiveServer.stop()]);

      status = ServerStatus.STOPPED;
      StatusBar.startText();
    }
  },

  async restart() {
    if (status === ServerStatus.STARTED) {
      Log.server('Restarting...');
      await this.stop();
      try {
        await this.start({
          restarting: true,
        });
      } catch (e) {
        this.stopAll();
      }
    }
  },

  async toggle() {
    switch (status) {
      case ServerStatus.STOPPED:
        await this.start();
        break;
      case ServerStatus.STARTED:
        await this.stopAll();
        break;
    }
  },

  isStarted() {
    return status === ServerStatus.STARTED;
  },

  isStartedDevelopment() {
    return this.isStarted() && serverMode === ServerMode.DEV;
  },

  isStartedProduction() {
    return this.isStarted() && serverMode === ServerMode.PROD;
  },

  getServerMode() {
    return serverMode;
  },
};