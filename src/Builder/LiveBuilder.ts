import { window, ProgressLocation } from 'vscode';
import path from 'path';

import chokidar from 'chokidar';

const DELAY_LESS = 500;

import Builder from './Builder';
import Server from '../Server/Server';
import Utils from '../Utils/Utils';
import Config from '../Utils/Config';
import LiveServer from '../Server/LiveServer';
import { Ui5App } from '../Types/Types';

let watchApps: chokidar.FSWatcher | undefined;

let awaiter: Record<string, ReturnType<typeof setTimeout>>;
let timeouts: Record<string, ReturnType<typeof setTimeout>>;

export default {
  async attachWatch(): Promise<void> {
    if (watchApps) {
      watchApps.close();
      watchApps = undefined;
    }
    const distFolder: string = String(Config.general('distFolder'));
    const sWorkspaceRootPath = Utils.getWorkspaceRootPath();
    watchApps = chokidar.watch([sWorkspaceRootPath], {
      ignoreInitial: true,
      ignored: (sPath: string) => {
        let bIgnore = false;
        const aIgnored: Array<string> = ['.git', '.svn', '.hg', '.node_modules', distFolder];
        for (let i = 0; i < aIgnored.length && !bIgnore; i++) {
          const sIgnored = aIgnored[i];
          bIgnore = sPath.includes(sIgnored);
        }
        return bIgnore;
      },
      usePolling: false,
    });
    watchApps.on('add', (sFilePath) => this.fileChanged(sFilePath));
    watchApps.on('change', (sFilePath) => this.fileChanged(sFilePath));
    watchApps.on('unlink', (sFilePath) => this.fileChanged(sFilePath));
  },

  awaiter: {},
  async fileChanged(sFilePath: string): Promise<void> {
    const fileExtension = path.extname(sFilePath).replace('.', '');
    const bIsLessFile = fileExtension === 'less';
    const bIsCssFile = fileExtension === 'css';

    const ui5App = await Utils.findUi5AppForFsPath(sFilePath);

    if (ui5App) {
      const sKey = `${ui5App.srcFsPath}-${bIsLessFile}`;
      if (awaiter[sKey]) {
        clearTimeout(awaiter[sKey]);
        delete awaiter[sKey];
      }
      awaiter[sKey] = setTimeout(async () => {
        const watchExtensions = String(Config.server('watchExtensions')).replace(/\\s/g, '');
        const watchExtensionsArray = watchExtensions.split(',');
        const bWatchedExtension = watchExtensionsArray.includes(fileExtension);
        let bRefreshedServer = false;

        const bChangedSrc = Utils.isUi5AppFsPathSrc(ui5App, sFilePath);
        if (bChangedSrc) {
          // Production
          if (Server.isStartedProduction()) {
            if (bIsLessFile) {
              await this.liveCompileLess(ui5App, ui5App.srcFsPath, [ui5App.srcFsPath, ui5App.distFsPath]);
              await Builder.compressCss(ui5App, ui5App.distFsPath);
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

  async checkRefreshApps(sFilePath: string): Promise<boolean> {
    let bRefreshedServer = false;
    const baseName = path.basename(sFilePath);
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
  async liveCompileLess(ui5App: Ui5App, srcFsPath: string, aDistFsPath: Array<string> | string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const buildLess = Config.builder('buildLess');
      if (buildLess && ui5App) {
        const sTimeoutKey = `_liveCompileTimeout${ui5App.folderName}`;
        clearTimeout(timeouts[sTimeoutKey]);
        timeouts[sTimeoutKey] = setTimeout(async () => {
          await window.withProgress(
            {
              location: ProgressLocation.Notification,
              title: `ui5-tools > Building css files for`,
              cancellable: true,
            },
            async (progress, token) => {
              progress.report({ message: ui5App.folderName });
              await Builder.compileLess(ui5App, srcFsPath, aDistFsPath);
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
