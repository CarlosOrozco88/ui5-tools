import { workspace, RelativePattern, Uri, extensions, commands } from 'vscode';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import https from 'https';
import http from 'http';

import Config from './Config';
import Log from './Log';

let ui5Apps = [];
let getUi5AppsPromise;
let sPromiseStatus;

const Utils = {
  async getAllUI5Apps(bRefresh) {
    if (!getUi5AppsPromise || (bRefresh && !sPromiseStatus)) {
      getUi5AppsPromise = new Promise(async (resolve, reject) => {
        try {
          sPromiseStatus = 'loading';
          ui5Apps = [];

          let srcFolder = Config.general('srcFolder');
          let libraryFolder = Config.general('libraryFolder');
          let distFolder = Config.general('distFolder');

          let aWorkspacesPromises = [];
          for (let wsUri of workspace.workspaceFolders) {
            let aManifestList = await workspace.findFiles(
              new RelativePattern(wsUri, `**/{${srcFolder},${libraryFolder}}/manifest.json`),
              new RelativePattern(wsUri, `**/{node_modules,.git}/`)
            );
            aWorkspacesPromises.push(aManifestList);
          }
          let aWorkspacesList = await Promise.all(aWorkspacesPromises);

          let aPaths = new Set();
          aWorkspacesList.forEach((aWorkspaceManifests) => {
            aWorkspaceManifests.forEach((oUriManifest) => {
              aPaths.add(oUriManifest.fsPath);
            });
          });

          let aManifestPromises = [];
          for (let manifestFsPath of aPaths) {
            let manifestUri = Uri.file(manifestFsPath);
            try {
              let manifestPromise = workspace.fs.readFile(manifestUri);
              aManifestPromises.push(manifestPromise);
            } catch (oError) {
              Log.logGeneral(oError.message, 'ERROR');
            }
          }

          let aManifestsFiles = await Promise.allSettled(aManifestPromises);

          let i = 0;
          for (let manifestFsPath of aPaths) {
            let manifest;
            let manifestPromise = aManifestsFiles[i];
            if (manifestPromise.status === 'fulfilled') {
              try {
                manifest = JSON.parse(manifestPromise.value.toString());
              } catch (oError) {
                Log.logGeneral(oError.message, 'ERROR');
              }

              if (manifest?.['sap.app']?.id) {
                let type = manifest?.['sap.app']?.type || 'application';
                let isLibrary = type === 'library';
                let namespace = manifest['sap.app'].id;
                let appSrcFolder = isLibrary ? libraryFolder : srcFolder;

                if (namespace) {
                  let manifestInnerPath = path.join(appSrcFolder, 'manifest.json');
                  let appFsPath = manifestFsPath.replace(manifestInnerPath, '');
                  let appResourceDirname = manifestFsPath.replace(path.sep + manifestInnerPath, '');

                  let appConfigPath = path.join(appResourceDirname, 'ui5-tools.json');
                  // clean all srcFolders/libraryFolders/distFolders if has any parent app
                  let appServerPath = Utils.fsPathToServerPath(appFsPath);

                  let srcFsPath = path.join(appFsPath, appSrcFolder);
                  let distFsPath = path.join(appFsPath, distFolder);

                  let sDeployFolder = Config.deployer('deployFolder');
                  let deployFsPath = sDeployFolder == 'Dist Folder' ? distFsPath : appFsPath;

                  let folderName = path.basename(appFsPath);

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
                  'ERROR'
                );
              }
            }
            i++;
          }

          Log.logGeneral(`${ui5Apps.length} ui5 projects found!`);

          let aResourcesDirname = ui5Apps.map((app) => app.appResourceDirname);
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

  fsPathToServerPath(appFsPath) {
    let workspaceRootPath = Utils.getWorkspaceRootPath();
    let libraryFolder = Config.general('libraryFolder');
    let distFolder = Config.general('distFolder');
    let srcFolder = Config.general('srcFolder');

    let appServerPath = appFsPath.replace(workspaceRootPath, '').split(path.sep).join('/');
    appServerPath = appServerPath
      .replace(`/${libraryFolder}/`, '/')
      .replace(`/${srcFolder}/`, '/')
      .replace(`/${distFolder}/`, '/');
    return appServerPath;
  },

  getWorkspaceRootPath() {
    let baseDirWorkspace = '';
    let workspaceFileUri = workspace.workspaceFile;
    if (workspaceFileUri) {
      baseDirWorkspace = path.dirname(workspaceFileUri.fsPath);
    } else {
      // only 1 workspace folder
      let workspaceFolders = workspace.workspaceFolders;
      baseDirWorkspace = workspaceFolders[0].uri.fsPath;
    }
    return baseDirWorkspace;
  },

  getExtensionInfo() {
    return extensions.getExtension('carlosorozcojimenez.ui5-tools');
  },

  getExtensionFsPath() {
    return Utils.getExtensionInfo().extensionUri.fsPath;
  },

  loadEnv() {
    let baseDir = Utils.getWorkspaceRootPath();
    let oDotEnv = dotenv.config({
      path: path.join(baseDir, '.env'),
    });
    return oDotEnv.parsed || {};
  },

  getHttpsCert() {
    let ui5ToolsPath = Utils.getExtensionFsPath();
    return {
      key: fs.readFileSync(path.join(ui5ToolsPath, 'static', 'cert', 'server.key')),
      cert: fs.readFileSync(path.join(ui5ToolsPath, 'static', 'cert', 'server.cert')),
    };
  },

  getFramework() {
    let resourcesProxy = Config.server('resourcesProxy');
    let framework = '';
    if (resourcesProxy.indexOf('OpenUI5') >= 0) {
      framework = 'openui5';
    } else if (resourcesProxy.indexOf('SAPUI5') >= 0 || resourcesProxy === 'Gateway') {
      framework = 'sapui5';
    }
    return framework;
  },

  async getUi5ToolsFile(ui5App) {
    let ui5AppConfig = undefined;
    if (ui5App) {
      try {
        let appConfigFile = await workspace.fs.readFile(Uri.file(ui5App.appConfigPath));
        ui5AppConfig = JSON.parse(appConfigFile.toString());
      } catch (oError) {
        ui5AppConfig = undefined;
      }
    }
    return ui5AppConfig;
  },

  async setUi5ToolsFile(ui5App, oConfigFile) {
    if (ui5App && typeof oConfigFile === 'object') {
      try {
        let sConfigFile = JSON.stringify(oConfigFile, undefined, 2);
        await workspace.fs.writeFile(Uri.file(ui5App.appConfigPath), Buffer.from(sConfigFile));
      } catch (oError) {
        throw oError;
      }
    }
    return oConfigFile;
  },

  async getManifest(uriOrManifest) {
    let manifest = undefined;
    if (uriOrManifest) {
      if (typeof uriOrManifest === 'string') {
        let libraryFolder = Config.general('libraryFolder');
        let distFolder = Config.general('distFolder');
        let manifestString = await workspace.findFiles(
          new RelativePattern(uriOrManifest, `**/manifest.json`),
          `**/{${distFolder},${libraryFolder},node_modules}/**`,
          1
        );
        if (manifestString.length) {
          let uri = Uri.file(manifestString[0].fsPath);
          let file = await workspace.fs.readFile(uri);
          manifest = JSON.parse(file.toString());
        }
      } else {
        manifest = uriOrManifest;
      }
    }
    return manifest;
  },

  async getManifestLibrary(uriOrManifest) {
    let isLib = false;
    let manifest = await Utils.getManifest(uriOrManifest);
    if (manifest?.['sap.app']?.type === 'library') {
      isLib = true;
    }
    return isLib;
  },

  async getManifestId(uriOrManifest) {
    let manifestId = undefined;
    let manifest = await Utils.getManifest(uriOrManifest);
    if (manifest?.['sap.app']?.id) {
      manifestId = manifest['sap.app'].id;
    }
    return manifestId;
  },

  getOptionsVersion() {
    let ui5Version = Config.general('ui5Version');
    let ui5toolsData = {
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
    let resourcesProxy = Config.server('resourcesProxy');
    return resourcesProxy === 'CDN SAPUI5' || resourcesProxy === 'Gateway';
  },

  isUi5AppFsPath(ui5App, sFsFilePath) {
    return sFsFilePath.indexOf(ui5App.appFsPath) === 0;
  },
  isUi5AppFsPathSrc(ui5App, sFsFilePath) {
    return sFsFilePath.indexOf(ui5App.srcFsPath) === 0;
  },
  isUi5AppFsPathDist(ui5App, sFsFilePath) {
    return sFsFilePath.indexOf(ui5App.distFsPath) === 0;
  },

  async findUi5AppForFsPath(sFsFilePath) {
    let ui5Apps = await Utils.getAllUI5Apps();
    let oUi5App = ui5Apps.find((ui5App) => this.isUi5AppFsPath(ui5App, sFsFilePath));

    return oUi5App;
  },

  getMethods(obj) {
    let properties = new Set();
    let currentObj = obj;
    let aExclude = [
      'constructor',
      '__defineGetter__',
      '__defineSetter__',
      'hasOwnProperty',
      '__lookupGetter__',
      '__lookupSetter__',
      'isPrototypeOf',
      'propertyIsEnumerable',
    ];
    do {
      Object.getOwnPropertyNames(currentObj).map((item) => properties.add(item));
    } while ((currentObj = Object.getPrototypeOf(currentObj)));
    return [...properties.keys()].filter((item) => {
      return typeof obj[item] === 'function' && item.indexOf('set') !== 0 && aExclude.indexOf(item) === -1;
    });
  },

  fetchFile(url, options = { timeout: 5000 }) {
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
              } catch (e) {
                reject(e.message);
              }
            });
          }
        })
        .on('error', (e) => {
          reject(e);
        });
    });
  },
};

export default Utils;
