import { window, ProgressLocation } from 'vscode';
import path from 'path';

import chokidar from 'chokidar';

const DELAY_LESS = 500;

import Builder from './Builder';
import Server from '../Server/Server';
import Utils from '../Utils/Utils';
import Config from '../Utils/Config';
import LiveServer from '../Server/LiveServer';

export default {
  watchApps: undefined,

  async attachWatch() {
    if (this.watchApps) {
      this.watchApps.close();
      this.watchApps = undefined;
    }
    let sWorkspaceRootPath = Utils.getWorkspaceRootPath();
    this.watchApps = chokidar.watch([sWorkspaceRootPath], {
      ignoreInitial: true,
      ignored: [/\.git\//, /\.svn\//, /\.hg\//, /\.node_modules\//],
      usePolling: false,
    });
    this.watchApps.on('add', (sFilePath) => this.fileChanged(sFilePath));
    this.watchApps.on('change', (sFilePath) => this.fileChanged(sFilePath));
    this.watchApps.on('unlink', (sFilePath) => this.fileChanged(sFilePath));
  },

  awaiter: {},
  async fileChanged(sFilePath) {
    let fileExtension = path.extname(sFilePath).replace('.', '');
    let bIsLessFile = fileExtension === 'less';
    let bIsCssFile = fileExtension === 'css';

    let ui5App = await Utils.findUi5AppForFsPath(sFilePath);

    if (ui5App) {
      let sKey = `${ui5App.srcFsPath}-${bIsLessFile}`;
      if (this.awaiter[sKey]) {
        clearTimeout(this.awaiter[sKey]);
        delete this.awaiter[sKey];
      }
      this.awaiter[sKey] = setTimeout(async () => {
        let watchExtensions = Config.server('watchExtensions').replace(/\\s/g, '');
        let watchExtensionsArray = watchExtensions.split(',');
        let bWatchedExtension = watchExtensionsArray.includes(fileExtension);
        let bRefreshedServer = false;

        let bChangedSrc = Utils.isUi5AppFsPathSrc(ui5App, sFilePath);
        if (bChangedSrc) {
          // Production
          if (Server.isStartedProduction()) {
            if (bIsLessFile) {
              await this.liveCompileLess(ui5App, ui5App.srcFsPath, [ui5App.srcFsPath, ui5App.distFsPath]);
              await Builder.compressFiles(ui5App.distFsPath, {
                js: false,
                json: false,
                xml: false,
                css: true,
              });
            } else if (bWatchedExtension && !bIsCssFile) {
              await Builder.buildProject(ui5App, undefined, false);
            }
          } else {
            // Allways except when production
            if (bIsLessFile) {
              await this.liveCompileLess(ui5App, ui5App.srcFsPath, ui5App.srcFsPath);
            }
          }

          bRefreshedServer = await this.checkRefreshApps(sFilePath);
        }

        if (!bRefreshedServer && bWatchedExtension) {
          LiveServer.refresh(sFilePath);
        }
      }, 500);
    } else {
      this.checkRefreshApps(sFilePath);
    }
  },

  async checkRefreshApps(sFilePath) {
    let bRefreshedServer = false;
    let baseName = path.basename(sFilePath);
    if (['manifest.json', '.env'].includes(baseName)) {
      await Server.restart();
      LiveServer.refresh(sFilePath);

      bRefreshedServer = true;
    }
    return bRefreshedServer;
  },

  /**
   * Live compile less to css
   * @param {TextDocument} event save file event
   */
  async liveCompileLess(ui5App, srcFsPath, aDistFsPath) {
    return new Promise(async (resolve, reject) => {
      let buildLess = Config.builder('buildLess');
      if (buildLess && ui5App) {
        let sTimeoutKey = `_liveCompileTimeout${ui5App.folderName}`;
        clearTimeout(this[sTimeoutKey]);
        this[sTimeoutKey] = setTimeout(async () => {
          await window.withProgress(
            {
              location: ProgressLocation.Notification,
              title: `ui5-tools > Building css files for`,
              cancellable: true,
            },
            async (progress, token) => {
              progress.report({ message: ui5App.folderName });
              await Builder.compileLess(srcFsPath, aDistFsPath, ui5App.manifest);
              resolve();
            }
          );
        }, DELAY_LESS);
      } else {
        resolve();
      }
    });
  },
};
