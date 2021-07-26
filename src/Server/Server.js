import express from 'express';
import opn from 'opn';
import http from 'http';
import https from 'https';
import portfinder from 'portfinder';

import Apps from './Apps';
import LiveServer from './LiveServer';
import StatusBar from '../StatusBar/StatusBar';
import Utils from '../Utils/Utils';
import Config from '../Utils/Config';
import OdataProxy from './Proxy/Odata';
import ResourcesProxy from './Proxy/Resources';
import IndexUI5Tools from './Index/UI5Tools';
import IndexLaunchpad from './Index/Launchpad';
import ejs from 'ejs';

const STATUSES = {
  STOPPED: 0,
  STARTING: 1,
  STARTED: 2,
  STOPPING: 3,
};
const SERVER_MODES = {
  DEV: 'DEV',
  PROD: 'PROD',
};

export default {
  serverApp: undefined,
  server: undefined,
  STATUSES: STATUSES,
  SERVER_MODES: SERVER_MODES,
  serverMode: SERVER_MODES.DEV,
  status: STATUSES.STOPPED,

  /**
   * Starts server in development mode (serving srcFolder)
   * @param {object} object params
   */
  async startDevelopment(oParameters) {
    await this.stopAll();

    this.serverMode = SERVER_MODES.DEV;
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
  async startProduction(oParameters) {
    await this.stopAll();

    this.serverMode = SERVER_MODES.PROD;
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
  async start(oParameters = { restarting: false }) {
    if (this.status === STATUSES.STOPPED) {
      if (oParameters.restarting) {
        await StatusBar.checkVisibility();
      }
      ResourcesProxy.resetCache();

      Utils.logOutputServer('Starting...');
      try {
        this.serverApp = express();
        this.serverApp.set('view engine', 'ejs');
        this.serverApp.disable('x-powered-by');
        // @ts-ignore
        this.serverApp.engine('ejs', ejs.__express);

        this.status = STATUSES.STARTING;
        StatusBar.startingText();

        // Reload config, checks new projects
        let bServeProduction = this.serverMode === SERVER_MODES.PROD;
        let sServerMode = bServeProduction ? SERVER_MODES.PROD : SERVER_MODES.DEV;
        let ui5Apps = await Utils.getAllUI5Apps();
        let oConfigParams = {
          ...oParameters,
          serverApp: this.serverApp,
          ui5Apps: ui5Apps,
          bServeProduction: bServeProduction,
          sServerMode: sServerMode,
          watch: Config.server('watch'),
          protocol: Config.server('protocol'),
          port: await portfinder.getPortPromise({
            port: Config.server('port'),
          }),
          portLiveReload: await portfinder.getPortPromise({
            port: 35729,
          }),
          timeout: Config.server('timeout'),
          baseDir: Utils.getWorkspaceRootPath(),
          ui5ToolsPath: Utils.getUi5ToolsPath(),
          ui5ToolsIndex: Utils.getUi5ToolsIndexFolder(),
          isLaunchpadMounted: Utils.isLaunchpadMounted(),
          bCacheBuster: Config.server('cacheBuster') === sServerMode,
        };

        if (oConfigParams.watch) {
          try {
            await LiveServer.start(oConfigParams);
          } catch (oError) {
            Utils.logOutputServer(oError, 'ERROR');
          }
        }

        Apps.serve(oConfigParams);

        try {
          await OdataProxy.set(oConfigParams);
        } catch (oError) {
          Utils.logOutputServer(oError, 'ERROR');
        }
        try {
          await ResourcesProxy.set(oConfigParams);
        } catch (oError) {
          Utils.logOutputServer(oError, 'ERROR');
        }

        try {
          await IndexUI5Tools.set(oConfigParams);
        } catch (oError) {
          Utils.logOutputServer(oError, 'ERROR');
        }
        try {
          await IndexLaunchpad.set(oConfigParams);
        } catch (oError) {
          Utils.logOutputServer(oError, 'ERROR');
        }

        if (oConfigParams.protocol === 'https') {
          this.server = https.createServer(Utils.getHttpsCert(), this.serverApp);
        } else {
          this.server = http.createServer(this.serverApp);
        }

        if (oConfigParams.timeout > 0) {
          this.server.timeout = oConfigParams.timeout;
        }
        this.server.listen(oConfigParams.port, () => {
          Utils.logOutputServer('Started!');
          let openBrowser = Config.server('openBrowser');
          let ui5ToolsIndex = Utils.getUi5ToolsIndexFolder();

          if (openBrowser && !oConfigParams.restarting) {
            opn(`${oConfigParams.protocol}://localhost:${oConfigParams.port}/${ui5ToolsIndex}/`);
          }
        });
        this.status = STATUSES.STARTED;
        StatusBar.stopText(oConfigParams.port);
      } catch (e) {
        this.stopAll();
        throw new Error(e);
      }
    } else {
      let sMessage = 'Error during server startup';
      Utils.logOutputServer(sMessage);
      throw new Error(sMessage);
    }
  },

  stopServer() {
    return new Promise((resolve, reject) => {
      if (this.server && this.server.listening) {
        Utils.logOutputServer('Stopping...');
        this.server.close(() => {
          Utils.logOutputServer('Stopped!');
          //server.unref();
          resolve();
        });
      } else {
        resolve();
      }
    });
  },

  async stop() {
    if (this.status === STATUSES.STARTED) {
      this.status = STATUSES.STOPPING;
      StatusBar.stoppingText();

      await this.stopServer();

      this.status = STATUSES.STOPPED;
      StatusBar.startText();
    }
  },

  async stopAll() {
    if (this.status === STATUSES.STARTED) {
      this.status = STATUSES.STOPPING;
      StatusBar.stoppingText();

      await Promise.all([this.stopServer(), LiveServer.stop()]);

      this.status = STATUSES.STOPPED;
      StatusBar.startText();
    }
  },

  async restart() {
    if (this.status === STATUSES.STARTED) {
      Utils.logOutputServer('Restarting...');
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
    switch (this.status) {
      case STATUSES.STOPPED:
        await this.start();
        break;
      case STATUSES.STARTED:
        await this.stopAll();
        break;
    }
  },

  isStarted() {
    return this.status === STATUSES.STARTED;
  },

  isStartedDevelopment() {
    return this.isStarted() && this.serverMode === SERVER_MODES.DEV;
  },

  isStartedProduction() {
    return this.isStarted() && this.serverMode === SERVER_MODES.PROD;
  },
};
