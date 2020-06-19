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

const expressApp = express();
expressApp.set('view engine', 'ejs');
expressApp.disable('x-powered-by');
// @ts-ignore
expressApp.engine('ejs', ejs.__express);

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
  serverApp: expressApp,
  server: undefined,
  STATUSES: STATUSES,
  SERVER_MODES: SERVER_MODES,
  serverMode: SERVER_MODES.DEV,
  status: STATUSES.STOPPED,

  /**
   * Starts server in development mode (serving srcFolder)
   * @param {object} object params
   */
  async startDevelopment({ restarting = false, cleanCache = true } = {}) {
    if (this.serverMode !== SERVER_MODES.DEV) {
      await this.stop();
    }
    this.serverMode = SERVER_MODES.DEV;
    await this.start({ restarting, cleanCache });
    return;
  },

  /**
   * Starts server in production mode (serving distFolder)
   * @param {object} object params
   */
  async startProduction({ restarting = false, cleanCache = true } = {}) {
    if (this.serverMode !== SERVER_MODES.PROD) {
      await this.stop();
    }
    this.serverMode = SERVER_MODES.PROD;
    await this.start({ restarting, cleanCache });
    return;
  },

  /**
   * Start server
   * @param {object} object params
   */
  async start({ restarting = false, cleanCache = true } = {}) {
    let started = false;
    if (this.status === STATUSES.STOPPED) {
      try {
        // Clean middlewares
        if (this.serverApp._router && this.serverApp._router.stack) {
          this.serverApp._router.stack.splice(2, this.serverApp._router.stack.length);
        }
        if (cleanCache) {
          ResourcesProxy.resetCache();
        }

        this.status = STATUSES.STARTING;
        StatusBar.startingText();

        // Reload config, checks new projects
        let ui5Apps = await Utils.getAllUI5Apps();

        let watch = Config.server('watch');
        if (watch) {
          await LiveServer.start(this.serverApp, ui5Apps);
        }

        // Static serve all apps
        ui5Apps.forEach((ui5App) => {
          let staticPath = ui5App.srcFsPath;
          if (this.serverMode === SERVER_MODES.PROD) {
            staticPath = ui5App.distFsPath;
          }
          this.serverApp.use(ui5App.appServerPath, express.static(staticPath));
        });

        await OdataProxy.set(this.serverApp);
        await ResourcesProxy.set(this.serverApp);

        await IndexUI5Tools.set(this.serverApp);
        await IndexLaunchpad.set(this.serverApp);

        let protocol = Config.server('protocol');
        let port = await portfinder.getPortPromise({
          port: Config.server('port'),
        });
        if (protocol === 'https') {
          this.server = https.createServer(Utils.getHttpsCert(), this.serverApp);
        } else {
          this.server = http.createServer(this.serverApp);
        }
        this.server.timeout = 30 * 1000;
        this.server.listen(port, () => {
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
    }
    return started;
  },

  stopServer() {
    return new Promise((resolv, reject) => {
      if (this.server && this.server.listening) {
        this.server.close(() => {
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

  async restart({ cleanCache = true } = {}) {
    let restarted = false;
    if (this.status === STATUSES.STARTED) {
      await this.stop({ restarting: true });
      await this.startDevelopment({
        restarting: true,
        cleanCache: cleanCache,
      });
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
