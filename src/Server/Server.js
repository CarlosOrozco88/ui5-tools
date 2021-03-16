import express from 'express';
import opn from 'opn';
import http from 'http';
import https from 'https';
import portfinder from 'portfinder';

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
  async startDevelopment({ restarting = false } = {}) {
    if (this.serverMode !== SERVER_MODES.DEV) {
      await this.stop();
    }
    this.serverMode = SERVER_MODES.DEV;
    try {
      await this.start({ restarting });
    } catch (e) {
      this.stop();
    }
    return;
  },

  /**
   * Starts server in production mode (serving distFolder)
   * @param {object} object params
   */
  async startProduction({ restarting = false } = {}) {
    if (this.serverMode !== SERVER_MODES.PROD) {
      await this.stop();
    }
    this.serverMode = SERVER_MODES.PROD;
    try {
      await this.start({ restarting });
    } catch (e) {
      this.stop();
    }
    return;
  },

  /**
   * Start server
   * @param {object} object params
   */
  async start({ restarting = false } = {}) {
    let started = false;
    if (this.status === STATUSES.STOPPED) {
      Utils.logOutputServer('Starting...');
      try {
        this.serverApp = express();
        this.serverApp.set('view engine', 'ejs');
        this.serverApp.disable('x-powered-by');
        // @ts-ignore
        this.serverApp.engine('ejs', ejs.__express);

        ResourcesProxy.resetCache();

        this.status = STATUSES.STARTING;
        StatusBar.startingText();

        // Reload config, checks new projects
        let ui5Apps = await Utils.getAllUI5Apps();

        let watch = Config.server('watch');
        if (watch) {
          try {
            await LiveServer.start(this.serverApp, ui5Apps);
          } catch (oError) {
            Utils.logOutputServer(oError);
          }
        }

        // Static serve all apps
        ui5Apps.forEach((ui5App) => {
          let staticPath = ui5App.srcFsPath;
          if (this.serverMode === SERVER_MODES.PROD) {
            staticPath = ui5App.distFsPath;
          }
          this.serverApp.use(ui5App.appServerPath, express.static(staticPath));
        });

        try {
          await OdataProxy.set(this.serverApp);
        } catch (oError) {
          Utils.logOutputServer(oError);
        }
        try {
          await ResourcesProxy.set(this.serverApp);
        } catch (oError) {
          Utils.logOutputServer(oError);
        }

        try {
          await IndexUI5Tools.set(this.serverApp);
        } catch (oError) {
          Utils.logOutputServer(oError);
        }
        try {
          await IndexLaunchpad.set(this.serverApp);
        } catch (oError) {
          Utils.logOutputServer(oError);
        }

        let protocol = Config.server('protocol');
        let port = await portfinder.getPortPromise({
          port: Config.server('port'),
        });
        if (protocol === 'https') {
          this.server = https.createServer(Utils.getHttpsCert(), this.serverApp);
        } else {
          this.server = http.createServer(this.serverApp);
        }
        let timeout = Config.server('timeout');
        if (timeout > 0) {
          this.server.timeout = timeout;
        }
        this.server.listen(port, () => {
          Utils.logOutputServer('Started!');
          let openBrowser = Config.server('openBrowser');
          let ui5ToolsIndex = Utils.getUi5ToolsIndexFolder();

          if (openBrowser && !restarting) {
            opn(`${protocol}://localhost:${port}/${ui5ToolsIndex}/`);
          }
        });
        this.status = STATUSES.STARTED;
        StatusBar.stopText(port);

        started = true;
      } catch (e) {
        this.stop();
        throw new Error(e);
      }
    } else {
      let sMessage = 'Error during server startup';
      Utils.logOutputServer(sMessage);
      throw new Error(sMessage);
    }
    return started;
  },

  stopServer() {
    return new Promise((resolv, reject) => {
      if (this.server && this.server.listening) {
        Utils.logOutputServer('Stopping...');
        this.server.close(() => {
          Utils.logOutputServer('Stopped!');
          //server.unref();
          resolv();
        });
      } else {
        resolv();
      }
    });
  },

  async stop({ restarting = false } = {}) {
    let stopped = false;
    if (this.status === STATUSES.STARTED) {
      if (!restarting) {
        this.serverMode = this.SERVER_MODES.DEV;
      }
      this.status = STATUSES.STOPPING;
      StatusBar.stoppingText();

      await Promise.all([this.stopServer(), LiveServer.stop()]);

      this.status = STATUSES.STOPPED;
      StatusBar.startText();
      stopped = true;
    }
    return stopped;
  },

  async restart() {
    let restarted = false;
    if (this.status === STATUSES.STARTED) {
      Utils.logOutputServer('Restarting...');
      await this.stop({ restarting: true });
      try {
        await this.startDevelopment({
          restarting: true,
        });
      } catch (e) {
        this.stop();
      }
      restarted = true;
    }
    return restarted;
  },

  async toggle() {
    switch (this.status) {
      case STATUSES.STOPPED:
        await this.startDevelopment();
        break;
      case STATUSES.STARTED:
        await this.stop();
        break;
    }
    return true;
  },
};
