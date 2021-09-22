import { workspace, RelativePattern, Uri, extensions, commands, Extension } from 'vscode';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import https from 'https';
import http from 'http';

import Config from './Config';
import Log from './Log';
import { Level, Ui5App, Ui5Apps, Ui5ToolsConfiguration } from '../Types/Types';

let ui5Apps: Ui5Apps = [];
let getUi5AppsPromise: Promise<Ui5Apps>;
let sPromiseStatus: 'loading' | undefined;

const Utils = {
  async getAllUI5Apps(bRefresh = false): Promise<Ui5Apps> {
    if (!getUi5AppsPromise || (bRefresh && !sPromiseStatus)) {
      getUi5AppsPromise = new Promise(async (resolve, reject) => {
        try {
          sPromiseStatus = 'loading';
          ui5Apps = [];

          const srcFolder = String(Config.general('srcFolder'));
          const libraryFolder = String(Config.general('libraryFolder'));
          const distFolder = String(Config.general('distFolder'));

          const aWorkspacesPromises = [];
          const workspaceFolders = workspace.workspaceFolders || [];
          for (const wsUri of workspaceFolders) {
            const aManifestList = await workspace.findFiles(
              new RelativePattern(wsUri, `**/{${srcFolder},${libraryFolder}}/manifest.json`),
              new RelativePattern(wsUri, `**/{node_modules,.git}/`)
            );
            aWorkspacesPromises.push(aManifestList);
          }
          const aWorkspacesList = await Promise.all(aWorkspacesPromises);

          const aPaths: Set<string> = new Set();
          aWorkspacesList.forEach((aWorkspaceManifests) => {
            aWorkspaceManifests.forEach((oUriManifest) => {
              aPaths.add(oUriManifest.fsPath);
            });
          });

          const aManifestPromises = [];
          for (const manifestFsPath of aPaths) {
            const manifestUri = Uri.file(manifestFsPath);
            try {
              const manifestPromise = workspace.fs.readFile(manifestUri);
              aManifestPromises.push(manifestPromise);
            } catch (oError: any) {
              Log.logGeneral(oError.message, Level.ERROR);
            }
          }

          const aManifestsFiles = await (Promise as any).allSettled(aManifestPromises);

          let i = 0;
          for (const manifestFsPath of aPaths) {
            let manifest;
            const manifestPromise = aManifestsFiles[i];
            if (manifestPromise.status === 'fulfilled') {
              try {
                manifest = JSON.parse(manifestPromise.value.toString());
              } catch (oError: any) {
                Log.logGeneral(oError.message, Level.ERROR);
              }

              if (manifest?.['sap.app']?.id) {
                const type = manifest?.['sap.app']?.type || 'application';
                const isLibrary = type === 'library';
                const namespace = manifest['sap.app'].id;
                const appSrcFolder = isLibrary ? libraryFolder : srcFolder;

                if (namespace) {
                  const manifestInnerPath = path.join(appSrcFolder, 'manifest.json');
                  const appFsPath = manifestFsPath.replace(manifestInnerPath, '');
                  const appResourceDirname = manifestFsPath.replace(path.sep + manifestInnerPath, '');

                  const appConfigPath = path.join(appResourceDirname, 'ui5-tools.json');
                  // clean all srcFolders/libraryFolders/distFolders if has any parent app
                  const appServerPath = Utils.fsPathToServerPath(appFsPath);

                  const srcFsPath = path.join(appFsPath, appSrcFolder);
                  const distFsPath = path.join(appFsPath, distFolder);

                  const sDeployFolder = Config.deployer('deployFolder');
                  const deployFsPath = sDeployFolder == 'Dist Folder' ? distFsPath : appFsPath;

                  const folderName = path.basename(appFsPath);

                  ui5Apps.push({
                    appFsPath,
                    appConfigPath,
                    appResourceDirname,
                    appServerPath,
                    type,
                    isLibrary,
                    srcFsPath,
                    distFsPath,
                    deployFsPath,
                    manifest,
                    folderName,
                    namespace,
                  });
                }
              } else {
                Log.logGeneral(
                  `Manifest found in ${manifestFsPath} path. If this manifest refers to an ui5 app, ` +
                    `check if it well formatted and has sap.app.type and sap.app.id properties filled`,
                  Level.ERROR
                );
              }
            }
            i++;
          }

          Log.logGeneral(`${ui5Apps.length} ui5 projects found!`);

          const aResourcesDirname = ui5Apps.map((app) => app.appResourceDirname);
          commands.executeCommand('setContext', 'ui5-tools:resourcesPath', aResourcesDirname);

          sPromiseStatus = undefined;

          resolve(ui5Apps);
        } catch (oError) {
          sPromiseStatus = undefined;
          reject(oError);
        }
      });
    }
    return getUi5AppsPromise;
  },

  fsPathToServerPath(appFsPath: string) {
    const workspaceRootPath = Utils.getWorkspaceRootPath();
    const libraryFolder = Config.general('libraryFolder');
    const distFolder = Config.general('distFolder');
    const srcFolder = Config.general('srcFolder');

    let appServerPath = appFsPath.replace(workspaceRootPath, '').split(path.sep).join('/');
    appServerPath = appServerPath
      .replace(`/${libraryFolder}/`, '/')
      .replace(`/${srcFolder}/`, '/')
      .replace(`/${distFolder}/`, '/');
    return appServerPath;
  },

  getWorkspaceRootPath(): string {
    let baseDirWorkspace = '';
    const workspaceFileUri = workspace.workspaceFile;
    if (workspaceFileUri) {
      baseDirWorkspace = path.dirname(workspaceFileUri.fsPath);
    } else {
      // only 1 workspace folder
      const workspaceFolders = workspace.workspaceFolders || [];
      baseDirWorkspace = workspaceFolders.length ? workspaceFolders[0].uri.fsPath : '';
    }
    return baseDirWorkspace;
  },

  getExtensionFsPath(): string {
    return extensions.getExtension('carlosorozcojimenez.ui5-tools')?.extensionUri?.fsPath || '';
  },

  loadEnv() {
    const baseDir = Utils.getWorkspaceRootPath();
    const oDotEnv = dotenv.config({
      path: path.join(baseDir, '.env'),
    });
    return oDotEnv.parsed || {};
  },

  getHttpsCert() {
    const ui5ToolsPath = Utils.getExtensionFsPath() || '';
    return {
      key: fs.readFileSync(path.join(ui5ToolsPath, 'static', 'cert', 'server.key')),
      cert: fs.readFileSync(path.join(ui5ToolsPath, 'static', 'cert', 'server.cert')),
    };
  },

  getFramework() {
    const resourcesProxy = String(Config.server('resourcesProxy'));
    let framework = '';
    if (resourcesProxy.indexOf('OpenUI5') >= 0) {
      framework = 'openui5';
    } else if (resourcesProxy.indexOf('SAPUI5') >= 0 || resourcesProxy === 'Gateway') {
      framework = 'sapui5';
    }
    return framework;
  },

  async getUi5ToolsFile(ui5App: Ui5App): Promise<Ui5ToolsConfiguration> {
    let ui5AppConfig = undefined;
    if (ui5App) {
      try {
        const appConfigFile = await workspace.fs.readFile(Uri.file(ui5App.appConfigPath));
        ui5AppConfig = JSON.parse(appConfigFile.toString());
      } catch (oError) {
        ui5AppConfig = undefined;
      }
    }
    return ui5AppConfig;
  },

  async setUi5ToolsFile(ui5App: Ui5App, oConfigFile: Ui5ToolsConfiguration): Promise<Ui5ToolsConfiguration> {
    const sConfigFile = JSON.stringify(oConfigFile, undefined, 2);
    await workspace.fs.writeFile(Uri.file(ui5App.appConfigPath), Buffer.from(sConfigFile));

    return oConfigFile;
  },

  getOptionsVersion() {
    const ui5Version = Config.general('ui5Version');
    const ui5toolsData = {
      compatVersion: 'edge', // for building
      showTree: false, // shows list or tree in docs folder
      theme: 'sap_bluecrystal', // theme to use in index server and flp
    };

    let majorV = 0;
    let minorV = 0;
    let patchV = 0;
    const aVersionMatch = String(ui5Version).match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (aVersionMatch) {
      majorV = parseInt(aVersionMatch[1], 10);
      minorV = parseInt(aVersionMatch[2], 10);
      patchV = parseInt(aVersionMatch[3], 10);
      ui5toolsData.compatVersion = `${majorV}.${minorV}`;
    }

    if (majorV == 1) {
      // sap.m.tree
      if (minorV >= 42) {
        ui5toolsData.showTree = true;
      }

      // theme
      if (minorV >= 65) {
        ui5toolsData.theme = 'sap_fiori_3';
      } else if (minorV >= 44) {
        ui5toolsData.theme = 'sap_belize';
      }
    }
    return ui5toolsData;
  },

  getUi5ToolsIndexFolder() {
    return 'ui5tools';
  },

  isLaunchpadMounted() {
    const resourcesProxy = Config.server('resourcesProxy');
    return resourcesProxy === 'CDN SAPUI5' || resourcesProxy === 'Gateway';
  },

  isUi5AppFsPath(ui5App: Ui5App, sFsFilePath: string) {
    return sFsFilePath.indexOf(ui5App.appFsPath) === 0;
  },
  isUi5AppFsPathSrc(ui5App: Ui5App, sFsFilePath: string) {
    return sFsFilePath.indexOf(ui5App.srcFsPath) === 0;
  },
  isUi5AppFsPathDist(ui5App: Ui5App, sFsFilePath: string) {
    return sFsFilePath.indexOf(ui5App.distFsPath) === 0;
  },

  async findUi5AppForFsPath(sFsFilePath: string) {
    const ui5Apps = await Utils.getAllUI5Apps();
    const oUi5App = ui5Apps.find((ui5App) => this.isUi5AppFsPath(ui5App, sFsFilePath));

    return oUi5App;
  },

  getDateMethods() {
    return [
      'getDate',
      'getDay',
      'getFullYear',
      'getHours',
      'getMilliseconds',
      'getMinutes',
      'getMonth',
      'getSeconds',
      'getTime',
      'getTimezoneOffset',
      'getUTCDate',
      'getUTCDay',
      'getUTCFullYear',
      'getUTCHours',
      'getUTCMilliseconds',
      'getUTCMinutes',
      'getUTCMonth',
      'getUTCSeconds',
      'getYear',
      'toGMTString',
      'toLocaleDateString',
      'toLocaleString',
      'toLocaleTimeString',
      'toString',
      'toTimeString',
      'toUTCString',
    ];
  },

  fetchFile(url: string, options = { timeout: 5000 }): Promise<string> {
    return new Promise((resolve, reject) => {
      url = url.split('//').join('/');

      let httpModule;
      if (url.indexOf('https') == 0) {
        httpModule = https;
      } else {
        httpModule = http;
      }
      httpModule
        .get(url, options, (res) => {
          if (res.statusCode !== 200) {
            reject();
          } else {
            let rawData = '';
            res.on('data', (chunk) => {
              rawData += chunk;
            });
            res.on('end', () => {
              try {
                resolve(rawData);
              } catch (e: any) {
                reject(e.message);
              }
            });
          }
        })
        .on(Level.ERROR, (e) => {
          reject(e);
        });
    });
  },
};

export default Utils;
