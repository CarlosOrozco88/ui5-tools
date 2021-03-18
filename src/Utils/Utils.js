import { window, workspace, RelativePattern, Uri, extensions, commands } from 'vscode';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

import Config from './Config';

let ui5toolsOutput = window.createOutputChannel(`ui5-tools`);
let ui5Apps = [];

const Utils = {
  async getAllUI5Apps() {
    return ui5Apps;
  },

  async refreshAllUI5Apps() {
    ui5Apps = [];
    let workspaceRootPath = Utils.getWorkspaceRootPath();
    let srcFolder = Config.general('srcFolder');
    let libraryFolder = Config.general('libraryFolder');
    let distFolder = Config.general('distFolder');

    for (let wsUri of workspace.workspaceFolders) {
      let manifestList = await workspace.findFiles(
        new RelativePattern(wsUri, `**/manifest.json`),
        new RelativePattern(wsUri, `**/{${distFolder},node_modules,.git}/`)
      );

      for (let i = 0; i < manifestList.length; i++) {
        let manifest = manifestList[i];
        let manifestUri = Uri.file(manifest.fsPath);

        try {
          let manifestString = await workspace.fs.readFile(manifestUri);
          let manifestJson = JSON.parse(manifestString.toString());
          let isLibrary = await Utils.getManifestLibrary(manifestJson);
          let namespace = await Utils.getManifestId(manifestJson);
          let appSrcFolder = isLibrary ? libraryFolder : srcFolder;

          if (namespace) {
            let alreadyInList = ui5Apps.find((app) => {
              return app.namespace === namespace;
            });
            if (!alreadyInList) {
              let manifestInnerPath = path.join(appSrcFolder, 'manifest.json');
              let appFsPath = manifestUri.fsPath.replace(manifestInnerPath, '');
              let appResourceDirname = manifestUri.fsPath.replace(path.sep + manifestInnerPath, '');
              let appServerPath = appFsPath.replace(workspaceRootPath, '').split(path.sep).join('/');

              let appConfigPath = path.join(appResourceDirname, 'ui5-tools.json');
              // clean all srcFolders/libraryFolders/distFolders if has any parent app
              appServerPath = appServerPath
                .replace(`/${libraryFolder}/`, '/')
                .replace(`/${srcFolder}/`, '/')
                .replace(`/${distFolder}/`, '/');
              let srcFsPath = path.join(appFsPath, appSrcFolder);
              let distFsPath = path.join(appFsPath, distFolder);
              let folderName = path.basename(appFsPath);

              ui5Apps.push({
                appFsPath: appFsPath,
                appConfigPath: appConfigPath,
                appResourceDirname: appResourceDirname,
                appServerPath: appServerPath,
                isLibrary: isLibrary,
                srcFsPath: srcFsPath,
                distFsPath: distFsPath,
                manifestUri: manifestUri,
                manifest: manifestJson,
                folderName: folderName,
                namespace: manifestJson['sap.app']['id'],
              });
            }
          }
        } catch (oError) {
          let sMessage = `Please, verify ${manifestUri} project.
          It has some errors.
          Verify manifest.json is correct and has sap.app.type and sap.app.id`;
          Utils.logOutputGeneral(sMessage, 'ERROR');
          window.showErrorMessage(sMessage);
        }
      }
    }
    ui5Apps = ui5Apps.sort((app1, app2) => {
      let sort = 0;
      if (app1.folderName > app2.folderName) {
        sort = 1;
      } else if (app1.folderName < app2.folderName) {
        sort = -1;
      }
      return sort;
    });
    Utils.logOutputGeneral(`${ui5Apps.length} ui5 projects detected`);
    let aResourcesDirname = ui5Apps.map((app) => app.appResourceDirname);
    commands.executeCommand('setContext', 'ui5-tools:resourcesPath', aResourcesDirname);
    return ui5Apps;
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

  getUi5ToolsInfo() {
    return extensions.getExtension('carlosorozcojimenez.ui5-tools');
  },

  getUi5ToolsPath() {
    return Utils.getUi5ToolsInfo().extensionUri.fsPath;
  },

  loadEnv() {
    let baseDir = Utils.getWorkspaceRootPath();
    let oDotEnv = dotenv.config({
      path: path.join(baseDir, '.env'),
    });
    return oDotEnv.parsed || {};
  },

  getHttpsCert() {
    let ui5ToolsPath = Utils.getUi5ToolsPath();
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
        let appConfigFile = await workspace.fs.readFile(Uri.parse(ui5App.appConfigPath));
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
        await workspace.fs.writeFile(Uri.parse(ui5App.appConfigPath), Buffer.from(sConfigFile));
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
    if (manifest && manifest['sap.app'].type === 'library') {
      isLib = true;
    }
    return isLib;
  },

  async getManifestId(uriOrManifest) {
    let manifestId = undefined;
    let manifest = await Utils.getManifest(uriOrManifest);
    if (manifest && manifest['sap.app'].id) {
      manifestId = manifest['sap.app'].id;
    }
    return manifestId;
  },

  getOptionsVersion(ui5toolsData = {}) {
    let ui5Version = Config.general('ui5Version');

    ui5toolsData.compatVersion = 'edge'; // for building
    ui5toolsData.showTree = false; // shows list or tree in docs folder
    ui5toolsData.theme = 'sap_bluecrystal'; // theme to use in index server and flp

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

  logOutput(sText, sLevel = 'LOG') {
    let oDate = new Date();
    let sDate = oDate.toLocaleTimeString();
    let sNewLine = `[${sLevel} ${sDate}] ${sText}`;
    ui5toolsOutput.appendLine(sNewLine);
    return console.log(sNewLine);
  },

  logOutputGeneral(sText, sLevel) {
    return Utils.logOutput(`General: ${sText}`, sLevel);
  },

  logOutputConfigurator(sText, sLevel) {
    return Utils.logOutput(`Configurator: ${sText}`, sLevel);
  },

  logOutputBuilder(sText, sLevel) {
    return Utils.logOutput(`Builder: ${sText}`, sLevel);
  },

  logOutputDeployer(sText, sLevel) {
    return Utils.logOutput(`Deployer: ${sText}`, sLevel);
  },

  logOutputServer(sText, sLevel) {
    return Utils.logOutput(`Server: ${sText}`, sLevel);
  },

  logOutputProxy(sText, sLevel) {
    return Utils.logOutput(`Server > Proxy: ${sText}`, sLevel);
  },

  newLogProviderProxy() {
    return Utils.newLogProvider(Utils.logOutputProxy);
  },

  newLogProviderDeployer() {
    return Utils.newLogProvider(Utils.logOutputDeployer);
  },

  newLogProvider(fnLogger = Utils.logOutputGeneral) {
    return {
      log: (sMessage) => {
        fnLogger(sMessage, 'LOG');
      },
      logVerbose: (oParam) => {
        // console.log(oParam)
      },
      debug: (sMessage) => {
        fnLogger(sMessage, 'DEBUG');
      },
      info: (sMessage) => {
        fnLogger(sMessage, 'INFO');
      },
      warn: (sMessage) => {
        fnLogger(sMessage, 'WARNING');
      },
      error: (sMessage) => {
        fnLogger(sMessage, 'ERROR');
      },
    };
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
};

export default Utils;
