import { workspace, RelativePattern, Uri, extensions, commands, ExtensionContext } from 'vscode';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import https from 'https';
import http from 'http';

import Config from './Config';
import Log from './Log';
import { Level, Ui5App, Ui5Apps, Ui5ToolsConfiguration } from '../Types/Types';

const ui5Apps: Ui5Apps = [];
let getUi5AppsPromise: Promise<Ui5Apps>;
let sPromiseStatus: 'loading' | undefined;
let extensionContext: ExtensionContext;
// import { ProjectsView } from '../ActivityBar/ProjectsView';

const Utils = {
  ui5Apps,

  async getAllUI5Apps(bRefresh = false): Promise<Ui5Apps> {
    if (!getUi5AppsPromise || (bRefresh && !sPromiseStatus)) {
      getUi5AppsPromise = new Promise(async (resolve, reject) => {
        Log.general(`Exploring ui5 projects...`);
        try {
          sPromiseStatus = 'loading';
          ui5Apps.splice(0, ui5Apps.length);

          const srcFolder = String(Config.general('srcFolder'));
          const libraryFolder = String(Config.general('libraryFolder'));
          let srcLibFolder = `**/{${srcFolder},${libraryFolder}}`;

          if ((!srcFolder && libraryFolder) || (srcFolder && !libraryFolder)) {
            srcLibFolder = `**/${srcFolder}${libraryFolder}`;
          } else if (srcFolder === libraryFolder) {
            srcLibFolder = !srcFolder ? `**` : `**/${srcFolder}`;
          }

          const aWorkspacesPromises = [];
          const workspaceFolders = workspace.workspaceFolders || [];
          for (const wsUri of workspaceFolders) {
            const aManifestList = workspace.findFiles(
              new RelativePattern(wsUri, `${srcLibFolder}/manifest.json`),
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

          const addManifests = [];
          for (const manifestFsPath of aPaths) {
            addManifests.push(this.addUi5App(manifestFsPath));
          }
          if (addManifests.length) {
            await Promise.allSettled(addManifests);
          }

          Log.general(`${ui5Apps.length} ui5 projects found!`);

          const aResourcesDirname = ui5Apps.map((app) => app.appResourceDirname);
          commands.executeCommand('setContext', 'ui5-tools:resourcesPath', aResourcesDirname);

          sPromiseStatus = undefined;

          // ProjectsView.refresh();

          resolve(ui5Apps);
        } catch (oError) {
          sPromiseStatus = undefined;
          reject(oError);
        }
      });
    }
    return getUi5AppsPromise;
  },

  async addUi5App(manifestFsPath: string): Promise<Ui5App | undefined> {
    const ui5App = await this.createUi5App(manifestFsPath);
    if (ui5App) {
      ui5Apps.push(ui5App);
    }
    return ui5App;
  },

  async createUi5App(manifestFsPath: string): Promise<Ui5App | undefined> {
    let ui5App: Ui5App | undefined;
    let manifest: any;
    try {
      const manifestPromise = await workspace.fs.readFile(Uri.file(manifestFsPath));
      manifest = JSON.parse(manifestPromise.toString());
    } catch (oError: any) {
      Log.general(oError.message, Level.ERROR);
    }

    if (manifest?.['sap.app']?.id) {
      const srcFolder = String(Config.general('srcFolder'));
      const libraryFolder = String(Config.general('libraryFolder'));

      const distFolder = String(Config.general('distFolder'));

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

        ui5App = {
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
        };
      }
    } else {
      Log.general(
        `Manifest found in ${manifestFsPath} path. If this manifest refers to an ui5 app,
        check if it well formatted and has sap.app.type and sap.app.id properties filled`,
        Level.ERROR
      );
    }
    return ui5App;
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
      baseDirWorkspace = workspaceFolders[0]?.uri?.fsPath || '';
    }
    return baseDirWorkspace;
  },

  getExtensionFsPath(): string {
    return extensions.getExtension('carlosorozcojimenez.ui5-tools')?.extensionUri?.fsPath || '';
  },

  getRuntimeFsPath(bAddResources = false, ui5Version?: string, framework = 'sapui5') {
    if (!ui5Version) {
      ui5Version = String(Config.general('ui5Version'));
    }

    const fsPath = path.join(
      this.getGlobalStorageFsPath(),
      framework,
      'runtime',
      ui5Version || 'unknown',
      bAddResources ? 'resources' : ''
    );
    return fsPath;
  },

  getSandboxFsPath(): string {
    return path.join(Utils.getExtensionFsPath(), 'static', 'scripts', 'sandbox.json');
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
    } else if (resourcesProxy.indexOf('SAPUI5') >= 0 || resourcesProxy === 'Gateway' || resourcesProxy === 'Runtime') {
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

  parseVersion(ui5Version: string) {
    let major = 0;
    let minor = 0;
    let patch = 0;
    const aVersionMatch = String(ui5Version).match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (aVersionMatch) {
      major = parseInt(aVersionMatch[1], 10);
      minor = parseInt(aVersionMatch[2], 10);
      patch = parseInt(aVersionMatch[3], 10);
    }
    return { major, minor, patch };
  },

  getOptionsVersion() {
    const ui5Version = '' + Config.general('ui5Version');
    const ui5toolsData = {
      compatVersion: 'edge', // for building
      showTree: false, // shows list or tree in docs folder
      theme: 'sap_bluecrystal', // theme to use in index server and flp
    };

    const { major, minor } = this.parseVersion(ui5Version);
    if (major && minor) {
      ui5toolsData.compatVersion = `${major}.${minor}`;
    }

    if (major === 1) {
      // sap.m.tree
      if (minor >= 42) {
        ui5toolsData.showTree = true;
      }

      // theme
      if (minor >= 65) {
        ui5toolsData.theme = 'sap_fiori_3';
      } else if (minor >= 44) {
        ui5toolsData.theme = 'sap_belize';
      }
    }
    return ui5toolsData;
  },

  getUi5ToolsIndexFolder() {
    return 'ui5tools';
  },

  isLaunchpadMounted() {
    const resourcesProxy = String(Config.server('resourcesProxy'));
    return ['CDN SAPUI5', 'Gateway', 'Runtime'].includes(resourcesProxy);
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

  fetchFile(url: string, options = {}): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const mergedOptions = {
        timeout: 5000,
        ...options,
      };
      const splitted = url.split('://');
      if (splitted.length > 1) {
        splitted[1] = splitted[1].split('//').join('/');
      }
      url = splitted.join('://');

      let httpModule;
      if (url.indexOf('https') == 0) {
        httpModule = https;
      } else {
        httpModule = http;
      }
      httpModule
        .get(url, mergedOptions, (res) => {
          if (res.statusCode !== 200) {
            reject();
          } else {
            const aData: Uint8Array[] = [];
            res.on('data', (chunk) => {
              aData.push(chunk);
            });
            res.on('end', () => {
              try {
                resolve(Buffer.concat(aData));
              } catch (e: any) {
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

  setWorkspaceContext(context: ExtensionContext) {
    extensionContext = context;
  },

  getWorkspaceContext(): ExtensionContext {
    return extensionContext;
  },

  getGlobalStorageUri(): Uri {
    return this.getWorkspaceContext().globalStorageUri;
  },

  getGlobalStorageFsPath(): string {
    return this.getGlobalStorageUri().fsPath;
  },
};

// TODO
// Check introduced in version 1.1.12 on 15/01/22. Maintain this during 1 or 2 months
const oldFsPath = path.join(Utils.getExtensionFsPath(), '..', 'carlosorozcojimenez.ui5-tools-support');
if (fs.existsSync(oldFsPath)) {
  fs.rmSync(oldFsPath, { recursive: true, force: true });
}
// End check

export default Utils;
