import express from 'express';
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

      Log.logServer('Starting...');
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

        if (oConfigParams.watch) {
          try {
            await LiveServer.start(oConfigParams);
          } catch (oError) {
            Log.logServer(oError, Level.ERROR);
          }
        }

        Apps.serve(oConfigParams);

        try {
          await OdataProxy.set(oConfigParams);
        } catch (oError) {
          Log.logServer(oError, Level.ERROR);
        }
        try {
          await ResourcesProxy.set(oConfigParams);
        } catch (oError) {
          Log.logServer(oError, Level.ERROR);
        }

        try {
          await IndexUI5Tools.set(oConfigParams);
        } catch (oError) {
          Log.logServer(oError, Level.ERROR);
        }
        try {
          await IndexLaunchpad.set(oConfigParams);
        } catch (oError) {
          Log.logServer(oError, Level.ERROR);
        }

        if (oConfigParams.protocol === 'https') {
          server = https.createServer(Utils.getHttpsCert(), serverApp);
        } else {
          server = http.createServer(serverApp);
        }

        if (oConfigParams.timeout > 0) {
          server.timeout = oConfigParams.timeout;
        }
        server.listen(oConfigParams.port, () => {
          Log.logServer('Started!');
          const openBrowser = Config.server('openBrowser');
          const ui5ToolsIndex = Utils.getUi5ToolsIndexFolder();

          if (openBrowser && !oConfigParams.restarting) {
            open(`${oConfigParams.protocol}://localhost:${oConfigParams.port}/${ui5ToolsIndex}/`);
          }
        });
        status = ServerStatus.STARTED;
        StatusBar.stopText(oConfigParams.port);
      } catch (e) {
        this.stopAll();
        throw new Error(e);
      }
    } else {
      const sMessage = 'Error during server startup';
      Log.logServer(sMessage);
      throw new Error(sMessage);
    }
  },

  stopServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (server && server.listening) {
        Log.logServer('Stopping...');
        server.close(() => {
          Log.logServer('Stopped!');
          //server.unref();
          resolve();
        });
      } else {
        resolve();
      }
    });
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
      Log.logServer('Restarting...');
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
};
