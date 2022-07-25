import { window } from 'vscode';

import express from 'express';

import open from 'open';
import http from 'http';
import https from 'https';
import portfinder from 'portfinder';

import Projects from './Projects';
import LiveServer from './LiveServer';
import StatusBar from '../StatusBar/StatusBar';
import Utils from '../Utils/ExtensionVscode';
import Log from '../Utils/LogVscode';
import Config from '../Utils/ConfigVscode';
import OdataProxy from './Proxy/Odata';
import ResourcesProxy from './Proxy/Resources';
import IndexUI5Tools from './Index/UI5Tools';
import IndexLaunchpad from './Index/Launchpad';
import ejs from 'ejs';
import { createHttpTerminator } from 'http-terminator';
import { ServerParameter, ServerOptions, ServerMode, ServerStatus, Protocols, Level } from '../Types/Types';
import { timeoutMiddleware } from './Middlewares/Timeout';
import Finder from '../Project/Finder';

let serverApp: express.Express;
let server: https.Server | http.Server;
let status: ServerStatus = ServerStatus.STOPPED;
let serverMode: ServerMode = ServerMode.DEV;
let oConfigParams: ServerOptions | undefined;

const Server = {
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
      Log.server('Starting...');
      try {
        serverApp = express();
        serverApp.set('view engine', 'ejs');
        serverApp.disable('x-powered-by');

        serverApp.engine('ejs', ejs.renderFile);

        status = ServerStatus.STARTING;
        StatusBar.startingText();

        const bServeProduction = serverMode === ServerMode.PROD;
        const sServerMode = bServeProduction ? ServerMode.PROD : ServerMode.DEV;

        const ui5Projects = await Finder.getAllUI5ProjectsArray();

        const protocol = Config.server('protocol') as keyof typeof Protocols;
        const newConfigParams = {
          serverApp: serverApp,
          ui5Projects: ui5Projects,
          bServeProduction: bServeProduction,
          sServerMode: sServerMode,
          watch: !!Config.server('watch'),
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
          bCacheBuster: [sServerMode, 'Allways'].includes(Config.server('cacheBuster') as string),
          restarting: !!oParameters?.restarting,
          bBabelSourcesLive: !!Config.server('babelSourcesLive'),
          sBabelSourcesExclude: Config.builder('babelSourcesExclude') as string,
        };
        oConfigParams = newConfigParams;

        if (oConfigParams.timeout) {
          serverApp.use(timeoutMiddleware(oConfigParams));
        }

        await OdataProxy.set(oConfigParams);
        await ResourcesProxy.set(oConfigParams);

        if (oConfigParams.watch) {
          await LiveServer.start(oConfigParams);
        }
        await IndexLaunchpad.set(oConfigParams);

        await Projects.serve(oConfigParams);

        await IndexUI5Tools.set(oConfigParams);

        if (oConfigParams.protocol === 'https') {
          server = https.createServer(Utils.getHttpsCert(), serverApp);
        } else {
          server = http.createServer(serverApp);
        }

        server.listen(oConfigParams.port, () => {
          status = ServerStatus.STARTED;
          StatusBar.stopText(newConfigParams.port);

          Log.server('Started!');
          const openBrowser = Config.server('openBrowser');

          if (openBrowser && !newConfigParams.restarting) {
            const ui5ToolsIndex = Utils.getUi5ToolsIndexFolder();
            open(`${newConfigParams.protocol}://localhost:${newConfigParams.port}/${ui5ToolsIndex}/`);
          }
        });
      } catch (e: any) {
        Log.server(e.message, Level.ERROR);
        window.showErrorMessage(e.message);
        throw e;
      }
    } else {
      const sMessage = Log.server('Error during server startup', Level.ERROR);
      window.showErrorMessage(sMessage);
      throw new Error(sMessage);
    }
  },

  getServerOptions() {
    return oConfigParams;
  },

  async stopServer(): Promise<void> {
    if (server && server.listening) {
      Log.server('Stopping...');

      const httpTerminator = createHttpTerminator({
        server,
      });
      httpTerminator.terminate();
      oConfigParams = undefined;
      Log.server('Stopped!');
    }
    return;
  },

  async stop() {
    if (status === ServerStatus.STARTED || status === ServerStatus.STARTING) {
      status = ServerStatus.STOPPING;
      StatusBar.stoppingText();

      await this.stopServer();

      status = ServerStatus.STOPPED;
      StatusBar.startText();
    }
  },

  async stopAll() {
    if (status === ServerStatus.STARTED || status === ServerStatus.STARTING) {
      status = ServerStatus.STOPPING;
      StatusBar.stoppingText();

      await Promise.all([this.stopServer(), LiveServer.stop()]);

      status = ServerStatus.STOPPED;
      StatusBar.startText();
    }
  },

  async restart() {
    if (status === ServerStatus.STARTED || status === ServerStatus.STARTING) {
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
        try {
          await this.start();
        } catch (oError) {
          await this.stopAll();
        }
        break;
      case ServerStatus.STARTED:
      case ServerStatus.STARTING:
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

  isCachebusterOn() {
    const oServerMode = this.getServerOptions();
    const sServerMode = oServerMode?.sServerMode ?? ServerMode.DEV;
    return [sServerMode, 'Allways'].includes(Config.server('cacheBuster') as string);
  },

  getServerMode() {
    return serverMode;
  },
};
export default Server;
