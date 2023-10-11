import path from 'path';
import { Progress, Uri, workspace } from 'vscode';
import chokidar, { FSWatcher } from 'chokidar';

import { BuildTasks, Ui5ToolsConfiguration } from '../Types/Types';
import Config from '../Utils/ConfigVscode';
import Finder from './Finder';

import Clean from './BuildSteps/Clean';
import Copy from './BuildSteps/Copy';
import Less from './BuildSteps/Less';
import Typescript from './BuildSteps/Typescript';
import Replacer from './BuildSteps/Replacer';
import Preload from './BuildSteps/Preload';
import Debug from './BuildSteps/Debug';
import Compress from './BuildSteps/Compress';
import LiveServer from '../Server/LiveServer';
import Server from '../Server/Server';
import StatusBar from '../StatusBar/StatusBar';
import Log from '../Utils/LogVscode';
import Extension from '../Utils/ExtensionVscode';
import ConfigVscode from '../Utils/ConfigVscode';

const DEFAULT_TASKS_BUILD: BuildTasks = {
  cleanFolder: true,
  copyFolder: true,
  replaceStrings: true,
  compileLess: true,
  compressFiles: true,
  createDebugFiles: true,
  cleanFiles: true,
  createPreload: true,
};

export default class Ui5Project {
  /** The manifest json */
  public manifest: Record<string, any>;
  public namespace: string;
  public type: string;
  public isLibrary: boolean;

  /** The actual path of the working folder that contains the manifest file */
  public fsPathWorking: string;
  /** Actual folder name that contains the manifest.json (webapp, src, ...) */
  public workingFolder: string;
  /**
   * Path that contains working folder. Here is where the code is modified by the user.
   * It is used in order to get proper menu in the project folder (build-deploy)
   */
  public fsPathBase: string;
  /** Folder name of the project path base */
  public folderName: string;
  /** Path where the ui5-tools.json config file should exsists */
  public fsPathConfig: string;
  /** Path where the server serves the project */
  public serverPath: string;
  /** Path that contains the build of the project */
  public fsPathDist: string;
  /** Path that contains the deploy files */
  public fsPathDeploy: string;

  private watcher: undefined | FSWatcher;
  private awaiterBuild: NodeJS.Timeout | undefined;
  private awaiterLess: NodeJS.Timeout | undefined;

  public constructor(manifestFsPath: string, manifest: Record<string, any>) {
    this.manifest = manifest;
    const namespace = manifest['sap.app'].id;
    const type = manifest['sap.app'].type;
    const isLibrary = type === 'library';

    const fsPathWorking = path.dirname(manifestFsPath);
    const workingFolder = path.basename(fsPathWorking);

    const appGenFolder = Config.general('appFolder') as string;
    const libraryGenFolder = Config.general('libraryFolder') as string;

    const isPlainFolder = ![appGenFolder, libraryGenFolder].includes(workingFolder);
    const fsPathBase = isPlainFolder ? fsPathWorking : path.resolve(fsPathWorking, '..');

    const folderName = path.basename(fsPathBase);
    const fsPathConfig = path.join(fsPathBase, 'ui5-tools.json');

    const serverPath = Finder.fsPathToServerPath(fsPathBase);

    const distFolder = Config.general('distFolder') as string;
    const fsPathDist = path.join(fsPathBase, distFolder);

    const sDeployFolder = Config.deployer('deployFolder') as string;
    const fsPathDeploy = sDeployFolder === 'Dist Folder' ? fsPathDist : fsPathBase;

    const props = {
      manifest,
      namespace,
      type,
      isLibrary,
      fsPathWorking,
      workingFolder,
      fsPathBase,
      folderName,
      fsPathConfig,
      serverPath,
      fsPathDist,
      fsPathDeploy,
    };
    this.namespace = props.namespace;
    this.type = props.type;
    this.isLibrary = props.isLibrary;
    this.fsPathWorking = props.fsPathWorking;
    this.workingFolder = props.workingFolder;
    this.fsPathBase = props.fsPathBase;
    this.folderName = props.folderName;
    this.fsPathConfig = props.fsPathConfig;
    this.serverPath = props.serverPath;
    this.fsPathDist = props.fsPathDist;
    this.fsPathDeploy = props.fsPathDeploy;

    this.watch();
  }

  watch(): Promise<void> {
    return new Promise(async (resolve) => {
      const aIgnored = await ConfigVscode.getExcludedFiles();

      this.watcher = chokidar.watch([this.fsPathWorking], {
        ignoreInitial: true,
        ignored: (sPath: string) => {
          const bIgnore = Extension.excluder(sPath, aIgnored);
          return bIgnore;
        },
        usePolling: false,
      });

      this.watcher.on('add', (sFilePath) => this.fileChanged(sFilePath));
      this.watcher.on('change', (sFilePath) => this.fileChanged(sFilePath));
      this.watcher.on('unlink', (sFilePath) => this.fileChanged(sFilePath));
      this.watcher.on('ready', () => {
        resolve();
      });
    });
  }

  async fileChanged(pathFileChanged: string) {
    const sPathResolved = path.resolve(pathFileChanged);
    const filename = path.basename(sPathResolved);
    const fileExtension = path.extname(sPathResolved).replace('.', '');
    let pathWorking = this.fsPathWorking;
    let doRefresh = true;

    if (filename === 'manifest.json') {
      try {
        const manifest = await Ui5Project.readManifest(sPathResolved);
        const isValidManifest = Ui5Project.isValidManifest(manifest);

        if (isValidManifest) {
          this.namespace = manifest['sap.app'].id;
          this.type = manifest['sap.app'].type;
        } else {
          throw new Error('Manifest changed without "sap.app.id" or "sap.app.type"');
        }
      } catch (oError) {
        await Finder.removeUi5Project(this);
        await StatusBar.checkVisibility(false);
        return;
      }
    }

    const OPTIONS: Record<string, () => void> = {};

    const buildless = Config.builder('buildLess') as boolean;
    const isServerStarted = Server.isStarted();

    if (buildless && isServerStarted) {
      OPTIONS.less = async () => {
        StatusBar.setExtraText(`Generating css for ${this.folderName}...`);
        const [firstPath, ...otherPaths] = await this.awaitLiveLess();
        pathWorking = firstPath && !otherPaths.length ? firstPath : pathWorking.replace('.less', '.css');
        doRefresh = true;
        StatusBar.setExtraText();
      };
    }

    const fnExecute = OPTIONS[fileExtension] ?? OPTIONS.default;
    await fnExecute?.();

    if (Server.isStartedProduction()) {
      await this.awaitLiveBuild();
      pathWorking = sPathResolved.replace(this.fsPathWorking, this.fsPathDist);
      LiveServer.refresh(pathWorking);
    } else if (doRefresh) {
      LiveServer.refresh(pathWorking);
    }
  }

  private awaitLiveLess(): Promise<Array<string>> {
    return new Promise((resolve) => {
      if (this.awaiterLess) {
        clearTimeout(this.awaiterLess);
      }
      this.awaiterLess = setTimeout(async () => {
        const aPaths = await Less.build(this, this.fsPathWorking, this.fsPathWorking);
        resolve(aPaths);
      }, 500);
    });
  }

  private awaitLiveBuild(): Promise<void> {
    return new Promise((resolve) => {
      if (this.awaiterBuild) {
        clearTimeout(this.awaiterBuild);
      }
      this.awaiterBuild = setTimeout(async () => {
        await this.build();
        resolve();
      }, 500);
    });
  }

  async unwatch() {
    if (this.awaiterLess) {
      clearTimeout(this.awaiterLess);
    }

    if (this.awaiterBuild) {
      clearTimeout(this.awaiterBuild);
    }
    this.watcher?.unwatch('*');
    await this.watcher?.close();
    delete this.watcher; // = undefined;
  }

  async close() {
    await this.unwatch();
  }

  static async readManifest(manifestFsPath: string): Promise<Record<string, any>> {
    const manifestUri = Uri.file(manifestFsPath);
    const manifestBuffer = await workspace.fs.readFile(manifestUri);
    const manifest = JSON.parse(manifestBuffer.toString());
    return manifest;
  }

  static isValidManifest(manifest: Record<string, any>) {
    const namespace = manifest?.['sap.app']?.id;
    const type = manifest?.['sap.app']?.type;

    return !!(namespace && type);
  }

  /**
   * Build a project
   */
  async build(
    oBuildOptions: { oTasks?: BuildTasks; progress?: Progress<any>; multiplier?: number } = {}
  ): Promise<void> {
    const { oTasks = DEFAULT_TASKS_BUILD, progress, multiplier = 1 } = oBuildOptions;
    const folderName = multiplier ? '' : `${this.folderName}`;
    progress?.report({ increment: 0 });

    const sWorkingFolder = this.fsPathWorking;
    const sDestFolder = this.fsPathDist;

    try {
      let increment = 10 * multiplier;
      progress?.report({ increment: increment, message: `${folderName} Reading manifest` });

      // Tasks
      const oTasksMerged = {
        ...DEFAULT_TASKS_BUILD,
        ...oTasks,
      };
      let {
        cleanFolder,
        copyFolder,
        replaceStrings,
        compileLess,
        compressFiles,
        createDebugFiles,
        cleanFiles,
        createPreload,
      } = oTasksMerged;

      // Config
      replaceStrings = replaceStrings && !!Config.builder('replaceStrings');
      compressFiles = compressFiles && !!Config.builder('uglifySources');
      createDebugFiles = createDebugFiles && !!Config.builder('debugSources');
      createPreload = createPreload && !!Config.builder('buildPreload');

      // Check that we are not deleting files from working folder
      if (sWorkingFolder === sDestFolder) {
        cleanFolder = false;
        copyFolder = false;
        replaceStrings = false;
        compileLess = true;
        compressFiles = false;
        createDebugFiles = false;
        cleanFiles = false;
      }

      // clean dist folder
      increment = 10 * multiplier;
      if (cleanFolder) {
        progress?.report({ increment: increment, message: `${folderName} Cleaning dist folder` });
        await Clean.folder(sDestFolder);
        increment = 0;
      }

      // copy files
      increment += 10 * multiplier;
      if (copyFolder) {
        progress?.report({ increment: increment, message: `${folderName} Copying files` });
        await Copy.folder(sWorkingFolder, sDestFolder);
        increment = 0;
      }

      // replace strings
      increment += 5 * multiplier;
      if (replaceStrings) {
        progress?.report({ increment: increment, message: `${folderName} Replacing strings` });
        await Replacer.strings(sDestFolder);
        increment = 0;
      }

      // compile less
      increment += 10 * multiplier;
      if (compileLess) {
        progress?.report({ increment: increment, message: `${folderName} Compile less to css` });
        await Less.build(this, sDestFolder, sDestFolder);
        increment = 0;
      }

      // clean less
      increment += 5 * multiplier;
      if (cleanFiles) {
        progress?.report({ increment: increment, message: `${folderName} Cleaning files` });
        await Clean.removeLess(this.fsPathDist);
        increment = 0;
      }

      // transpile ts files
      increment += 10 * multiplier;
      progress?.report({ increment: increment, message: `${folderName} Transpile ts files` });
      await Typescript.build(sDestFolder, { sourceMaps: false });
      increment = 0;

      // create dbg files
      increment += 10 * multiplier;
      if (createDebugFiles) {
        progress?.report({ increment: increment, message: `${folderName} Creating dbg files` });
        await Debug.build(sDestFolder, sDestFolder);
        increment = 0;
      }

      // compress files
      increment += 10 * multiplier;
      if (compressFiles) {
        progress?.report({ increment: increment, message: `${folderName} Compress files` });
        await Compress.all(sDestFolder);
        increment = 0;
      }

      // create preload
      increment += 20 * multiplier;
      if (createPreload) {
        progress?.report({ increment: increment, message: `${folderName} Building preload` });
        if (!cleanFolder) {
          await Preload.clean(this, sDestFolder);
        }
        await Preload.build(this, sDestFolder, sDestFolder);
        increment = 0;
      }

      // End build
    } catch (error: any) {
      throw new Error(error);
    }
  }

  /** Returns the current served fs path */
  getServedPath(bServeProduction = false) {
    const fsServedPath = bServeProduction ? this.fsPathDist : this.fsPathWorking;
    return fsServedPath;
  }

  async getUi5ToolsFile(): Promise<Ui5ToolsConfiguration> {
    let ui5ProjectConfig = undefined;

    try {
      const uri = Uri.file(this.fsPathConfig);
      const appConfigFile = await workspace.fs.readFile(uri);
      ui5ProjectConfig = JSON.parse(appConfigFile.toString());
    } catch (oError) {
      ui5ProjectConfig = undefined;
    }
    return ui5ProjectConfig;
  }

  async setUi5ToolsFile(oConfigFile: Ui5ToolsConfiguration): Promise<Ui5ToolsConfiguration> {
    const uri = Uri.file(this.fsPathConfig);
    const sConfigFile = JSON.stringify(oConfigFile, undefined, 2);
    await workspace.fs.writeFile(uri, Buffer.from(sConfigFile));

    Log.deployer(`ui5-tools.json: File created!`);
    return oConfigFile;
  }

  isFolderName(sFolderName: string) {
    return this.folderName === sFolderName;
  }

  isFileInFsPath(sFsFilePath: string) {
    return sFsFilePath.indexOf(this.fsPathBase) === 0;
  }

  isFileInFsPathWorking(sFsFilePath: string) {
    return sFsFilePath.indexOf(this.fsPathWorking) === 0;
  }

  toJSON() {
    return {
      manifest: this.manifest,
      namespace: this.namespace,
      type: this.type,
      isLibrary: this.isLibrary,
      fsPathWorking: this.fsPathWorking,
      workingFolder: this.workingFolder,
      fsPathBase: this.fsPathBase,
      folderName: this.folderName,
      fsPathConfig: this.fsPathConfig,
      serverPath: this.serverPath,
      fsPathDist: this.fsPathDist,
      fsPathDeploy: this.fsPathDeploy,
    };
  }
}
