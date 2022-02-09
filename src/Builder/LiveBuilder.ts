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
import Apps from '../Server/Apps';

let watchApps: chokidar.FSWatcher | undefined;

const awaiter: Record<string, ReturnType<typeof setTimeout>> = {};
const timeouts: Record<string, ReturnType<typeof setTimeout>> = {};

export default {
  watchApps,
  awaiter,
  timeouts,
  async attachWatch(): Promise<void> {
    if (this.watchApps) {
      await this.watchApps.close();
      this.watchApps = undefined;
    }

    const aIgnored = ['.git', '.svn', '.hg', '.node_modules', '.DS_Store'];

    const sWorkspaceRootPath = Utils.getWorkspaceRootPath();
    this.watchApps = chokidar.watch([sWorkspaceRootPath], {
      ignoreInitial: true,
      ignored: (sPath: string) => {
        const aPath = sPath.split(path.sep);
        const bIgnore = aIgnored.some((f) => aPath.includes(f));
        return bIgnore;
      },
      usePolling: false,
    });

    this.watchApps.on('add', (sFilePath) => this.fileChanged(sFilePath, 'add'));
    this.watchApps.on('change', (sFilePath) => this.fileChanged(sFilePath, 'change'));
    this.watchApps.on('unlink', (sFilePath) => this.fileChanged(sFilePath, 'unlink'));
  },

  async fileChanged(sFilePath: string, sAction: string): Promise<void> {
    const ui5App = await Utils.findUi5AppForFsPath(sFilePath);

    if (ui5App) {
      this.refreshUi5App(ui5App, sFilePath, sAction);
    } else {
      await this.checkRefreshApps(sFilePath, sAction);
    }
  },

  async refreshUi5App(ui5App: Ui5App, sFilePath: string, sAction: string) {
    const fileExtension = path.extname(sFilePath).replace('.', '');
    const bIsLessFile = fileExtension === 'less';
    const bIsCssFile = fileExtension === 'css';
    const sKey = `${ui5App.srcFsPath}-${bIsLessFile}`;
    if (this.awaiter[sKey]) {
      clearTimeout(this.awaiter[sKey]);
    }
    this.awaiter[sKey] = setTimeout(
      async (sKey) => {
        const watchExtensions = String(Config.server('watchExtensions')).replace(/\\s/g, '');
        const watchExtensionsArray = watchExtensions.split(',');
        const bWatchedExtension = watchExtensionsArray.includes(fileExtension);

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

          await this.checkRefreshApps(sFilePath, sAction, ui5App);
        }

        delete this.awaiter[sKey];
      },
      500,
      sKey
    );
  },

  async checkRefreshApps(sFilePath: string, sAction: string, ui5App?: Ui5App): Promise<void> {
    const baseName = path.basename(sFilePath);
    const fileExtension = path.extname(sFilePath).replace('.', '');
    const dirName = path.dirname(sFilePath);

    const srcFolder = String(Config.general('srcFolder'));
    const libraryFolder = String(Config.general('libraryFolder'));

    let bRefresh = false;
    switch (baseName) {
      case '.env': {
        await Server.restart();
        break;
      }
      case 'manifest.json': {
        const lastFolder = dirName.split(path.sep).pop() ?? '';

        bRefresh = false;
        if (srcFolder === libraryFolder) {
          bRefresh = srcFolder === lastFolder;
        } else if (srcFolder || libraryFolder) {
          bRefresh = !![srcFolder, libraryFolder].includes(lastFolder);
        }

        if (bRefresh && (sAction === 'add' || !ui5App)) {
          ui5App = await Utils.addUi5App(sFilePath);
          if (ui5App && Server.getServerOptions()?.serverApp) {
            await Apps.serveApp(ui5App);
          }
        }
        await Utils.getAllUI5Apps(true);
        break;
      }
    }
    const watchExtensions = String(Config.server('watchExtensions')).replace(/\\s/g, '');
    const watchExtensionsArray = watchExtensions.split(',');
    const bWatchedExtension = watchExtensionsArray.includes(fileExtension);
    if (ui5App && (bWatchedExtension || bRefresh)) {
      LiveServer.refresh(sFilePath);
    }
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
        clearTimeout(this.timeouts[sTimeoutKey]);
        this.timeouts[sTimeoutKey] = setTimeout(
          async (sTimeoutKey) => {
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
            delete this.timeouts[sTimeoutKey];
          },
          DELAY_LESS,
          sTimeoutKey
        );
      } else {
        resolve();
      }
    });
  },
};
