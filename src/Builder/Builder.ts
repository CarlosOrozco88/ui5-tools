import { workspace, window, RelativePattern, ProgressLocation, Progress, Uri, QuickPickItem } from 'vscode';
import path from 'path';

import os from 'os';
//@ts-ignore
import preload from 'openui5-preload';
import { minify, MinifyOutput } from 'terser';
import { pd as prettyData } from 'pretty-data';
import less from 'less';
//@ts-ignore
import lessOpenUI5 from 'less-openui5';

const lessOpenUI5Builder = new lessOpenUI5.Builder({});
const xmlHtmlPrePattern = /<(?:\w+:)?pre>/;

import Log from '../Utils/Log';
import Utils from '../Utils/Utils';
import Config from '../Utils/Config';
import { Ui5App, BuildTasks } from '../Types/Types';

import { transformAsync, BabelFileResult } from '@babel/core';
import presetEnv from '@babel/preset-env';

// @ts-ignore
import transformAsyncToPromises from 'babel-plugin-transform-async-to-promises';
// @ts-ignore
import transformRemoveConsole from 'babel-plugin-transform-remove-console';

const DEFAULT_TASKS_BUILD: BuildTasks = {
  cleanFolder: true,
  copyFolder: true,
  replaceStrings: true,
  compileLess: true,
  babelifyJSFiles: true,
  compressFiles: true,
  createDebugFiles: true,
  cleanFiles: true,
  createPreload: true,
};

export default {
  /**
   * Open command to project selection
   */
  async askProjectToBuild(): Promise<void> {
    let ui5App: Ui5App | undefined;
    try {
      Log.builder(`Asking project to build`);
      const ui5Apps = await Utils.getAllUI5Apps();
      if (ui5Apps.length > 1) {
        const qpOptions: Array<QuickPickItem> = [];
        ui5Apps.forEach((app) => {
          qpOptions.push({
            label: app.folderName,
            description: app.namespace,
          });
        });
        // ask for a project
        const ui5ProjectToBuild: QuickPickItem = await new Promise(async (resolve, reject) => {
          const ui5ProjectToBuildQp = await window.createQuickPick();
          ui5ProjectToBuildQp.title = 'ui5-tools > Builder > Select UI5 project';
          ui5ProjectToBuildQp.items = qpOptions;
          ui5ProjectToBuildQp.placeholder = 'Select UI5 project to build';
          ui5ProjectToBuildQp.canSelectMany = false;
          ui5ProjectToBuildQp.onDidAccept(async () => {
            if (ui5ProjectToBuildQp.selectedItems.length) {
              resolve(ui5ProjectToBuildQp.selectedItems[0]);
            } else {
              reject('No UI5 project selected');
            }
            ui5ProjectToBuildQp.hide();
          });
          ui5ProjectToBuildQp.show();
        });

        // fspath from selected project
        ui5App = ui5Apps.find((app) => {
          return app.namespace == ui5ProjectToBuild.description;
        });
      } else if (ui5Apps.length == 1) {
        // only one project
        ui5App = ui5Apps[0];
      }
    } catch (oError) {
      ui5App = undefined;
      throw oError;
    }
    await this.buildProject(ui5App);
  },

  /**
   * Build all workspace projects
   */
  async buildAllProjects(): Promise<void> {
    Log.builder(`Build all ui5 projects`);
    const ui5Apps = await Utils.getAllUI5Apps();
    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: `ui5-tools > Building all`,
        cancellable: true,
      },
      async (progress, token) => {
        progress.report({ increment: 0 });
        for (let i = 0; i < ui5Apps.length; i++) {
          const ui5App = ui5Apps[i];
          if (token.isCancellationRequested) {
            return;
          }
          progress.report({
            increment: 100 / ui5Apps.length,
            message: `${ui5App.folderName} (${i + 1}/${ui5Apps.length})`,
          });
          await this.build({ ui5App, progress, multiplier: 0 });
        }
        return;
      }
    );
    return;
  },

  /**
   * Open window withprogress to build project
   * @param {Object} ui5App object uri from project path
   */
  async buildProject(ui5App: Ui5App | undefined, oTasks = DEFAULT_TASKS_BUILD, bShowMessage = true): Promise<void> {
    if (ui5App) {
      const folderName = ui5App.folderName;
      Log.builder(`Building project ${folderName}`);
      await window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: `ui5-tools > Building project ${folderName}`,
          cancellable: true,
        },
        async (progress, token) => {
          token.onCancellationRequested(() => {
            throw new Error('Build canceled');
          });

          try {
            await this.build({ ui5App, oTasks, progress });

            const sMessage = Log.builder(`Project ${ui5App.folderName} builded!`);
            if (bShowMessage) {
              window.showInformationMessage(sMessage);
            }
          } catch (error: any) {
            throw new Error(error);
          }
        }
      );
    }
  },

  /**
   * Build a project
   */
  async build({
    ui5App,
    oTasks = DEFAULT_TASKS_BUILD,
    progress,
    multiplier = 1,
  }: {
    ui5App: Ui5App;
    oTasks?: BuildTasks;
    progress: Progress<any>;
    multiplier?: number;
  }): Promise<void> {
    const folderName = multiplier ? '' : `${ui5App.folderName}`;
    progress?.report({ increment: 0 });

    try {
      const srcFolder = Config.general('srcFolder');
      const libraryFolder = Config.general('libraryFolder');
      const distFolder = Config.general('distFolder');

      if (!srcFolder || !libraryFolder || !distFolder) {
        throw new Error('Invalid srcFolder or libraryFolder');
      }

      let increment = 10 * multiplier;
      progress?.report({ increment: increment, message: `${folderName} Reading manifest` });

      const { srcFsPath, distFsPath } = ui5App;

      // Tasks
      const oTasksMerged = {
        ...DEFAULT_TASKS_BUILD,
        ...oTasks,
      };
      let {
        cleanFolder,
        copyFolder,
        replaceStrings,
        // eslint-disable-next-line prefer-const
        compileLess,
        babelifyJSFiles,
        compressFiles,
        createDebugFiles,
        cleanFiles,
        createPreload,
      } = oTasksMerged;

      // Config
      replaceStrings = replaceStrings && Boolean(Config.builder('replaceStrings'));
      babelifyJSFiles = babelifyJSFiles && Boolean(Config.builder('babelSources'));
      compressFiles = compressFiles && Boolean(Config.builder('uglifySources'));
      createDebugFiles = createDebugFiles && Boolean(Config.builder('debugSources'));
      createPreload = createPreload && Boolean(Config.builder('buildPreload'));

      // Check that we are not deleting files from srcFolder
      if (srcFsPath === distFsPath) {
        cleanFolder = false;
        copyFolder = false;
        replaceStrings = false;
        babelifyJSFiles = false;
        compressFiles = false;
        createDebugFiles = false;
        cleanFiles = false;
      }

      // clean dist folder
      increment = 10 * multiplier;
      if (cleanFolder) {
        progress?.report({ increment: increment, message: `${folderName} Cleaning dist folder` });
        await this.cleanFolder(ui5App, distFsPath);
        increment = 0;
      }

      // copy files
      increment += 10 * multiplier;
      if (copyFolder) {
        progress?.report({ increment: increment, message: `${folderName} Copying files` });
        await this.copyFolder(ui5App, srcFsPath, distFsPath);
        increment = 0;
      }

      // replace strings
      increment += 10 * multiplier;
      if (replaceStrings) {
        progress?.report({ increment: increment, message: `${folderName} Replacing strings` });
        await this.replaceStrings(ui5App, distFsPath);
        increment = 0;
      }

      // compile less
      increment += 10 * multiplier;
      if (compileLess) {
        progress?.report({ increment: increment, message: `${folderName} Compile less to css` });
        await this.compileLess(ui5App, srcFsPath, distFsPath);
        increment = 0;
      }

      // babel js files
      increment += 5 * multiplier;
      if (babelifyJSFiles) {
        progress?.report({ increment: increment, message: `${folderName} Babelify js files` });
        await this.babelifyJSFiles(ui5App, distFsPath);
        increment = 0;
      }

      // compress files
      increment += 10 * multiplier;
      if (compressFiles) {
        progress?.report({ increment: increment, message: `${folderName} Compress files` });
        await this.compressFiles(ui5App, distFsPath);
        increment = 0;
      }

      // create dbg files
      increment += 5 * multiplier;
      if (createDebugFiles) {
        progress?.report({ increment: increment, message: `${folderName} Creating dbg files` });
        await this.createDebugFiles(ui5App, srcFsPath, distFsPath);
        increment = 0;
      }

      // clean files
      increment += 10 * multiplier;
      if (cleanFiles) {
        progress?.report({ increment: increment, message: `${folderName} Cleaning files` });
        await this.cleanFiles(ui5App, distFsPath);
        increment = 0;
      }

      // create preload
      increment += 20 * multiplier;
      if (createPreload) {
        progress?.report({ increment: increment, message: `${folderName} Building preload` });
        await this.createPreload(ui5App, srcFsPath, distFsPath);
        increment = 0;
      }

      // End build
    } catch (error: any) {
      throw new Error(error);
    }
  },

  /**
   * Deletes folder or file
   */
  async cleanFolder(ui5App: Ui5App, fsPath: string): Promise<void> {
    if (fsPath) {
      const uriToDelete = Uri.file(fsPath);
      Log.builder(`Deleting folder ${fsPath}`);
      try {
        await workspace.fs.delete(uriToDelete, {
          recursive: true,
          useTrash: true,
        });
      } catch (error: any) {
        if (error.code !== 'FileNotFound') {
          throw new Error(error);
        }
      }
    }
  },

  /**
   * Replace all strings
   */
  async replaceStrings(ui5App: Ui5App, folderPath: string): Promise<void> {
    const replaceExtensions = Config.builder('replaceExtensions');
    const pattern = new RelativePattern(folderPath, `**/*.{${replaceExtensions}}`);
    const files: Array<Uri> = await workspace.findFiles(pattern);

    const calculedKeys: Record<string, string> = this.replaceStringsValue();
    const aCalculedKeys: [string, string][] = Object.entries(calculedKeys);

    if (files.length) {
      Log.builder(`Replacing strings from ${folderPath}`);
      try {
        for (let i = 0; i < files.length; i++) {
          await this.replaceStringsFile(files[i], aCalculedKeys);
        }
      } catch (error: any) {
        throw new Error(error);
      }
    }
  },

  async replaceStringsFile(file: Uri, aCalculedKeys: [string, string][]): Promise<void> {
    if (file) {
      const rawFile = await workspace.fs.readFile(file);
      const stringfile = rawFile.toString();
      let newFile = stringfile;

      for (const [key, value] of aCalculedKeys) {
        newFile = newFile.replace(new RegExp('(<%){1}[\\s]*(' + key + '){1}[\\s]*(%>){1}', 'g'), value);
      }

      if (newFile !== stringfile) {
        await workspace.fs.writeFile(file, Buffer.from(newFile));
      }
    }
  },

  replaceStringsValue(): Record<string, string> {
    let keysValues: Array<any> = new Array(Config.builder('replaceKeysValues'));
    const calculedKeys: Record<string, string> = {};

    const oDate = new Date();
    const sComputedDateKeyBegin = 'COMPUTED_Date_';
    const aDateMethods = Utils.getDateMethods();
    const aDateValues = aDateMethods.map((sMethod: string) => {
      const sKey = `${sComputedDateKeyBegin}${sMethod}`;
      //@ts-ignore
      const sValue = '' + oDate[sMethod]();
      return { key: sKey, value: sValue };
    });
    keysValues = keysValues.concat(aDateValues);

    keysValues.forEach(({ key, value }) => {
      if (value && value.indexOf(sComputedDateKeyBegin) === 0) {
        const sFn = value.replace(sComputedDateKeyBegin, '');
        //@ts-ignore
        if (typeof oDate[sFn] == 'function') {
          if (!calculedKeys[key]) {
            //@ts-ignore
            calculedKeys[key] = oDate[sFn]();
          }
        }
      } else {
        calculedKeys[key] = value;
      }
    });
    return calculedKeys;
  },

  /**
   * Copies srcPath to destPath
   */
  async copyFolder(ui5App: Ui5App, srcPath: string, destPath: string): Promise<void> {
    const uriSrc = Uri.file(srcPath);
    const uriDest = Uri.file(destPath);
    Log.builder(`Copying folder from ${srcPath} to ${destPath}`);
    try {
      await workspace.fs.copy(uriSrc, uriDest, {
        overwrite: true,
      });
    } catch (error: any) {
      throw new Error(error);
    }
  },

  /**
   * Compile less from destPath
   */
  async compileLess(ui5App: Ui5App, srcPath: string, aDestPathParam: string | Array<string> = []): Promise<void> {
    let aDestPath: Array<string> = [];
    if (typeof aDestPathParam === 'string' && aDestPathParam) {
      aDestPath = [aDestPathParam];
    } else {
      aDestPath = aDestPath.concat(aDestPathParam);
    }
    if (aDestPath && aDestPath.length) {
      const { namespace } = ui5App;

      //if (isLibrary) {
      // Generate css for library
      const patternLessLibrary = new RelativePattern(srcPath, `**/library.source.less`);
      const lessFilesLibrary = await workspace.findFiles(patternLessLibrary);
      if (lessFilesLibrary.length) {
        for (let i = 0; i < lessFilesLibrary.length; i++) {
          Log.builder(`Compiling less theme from ${lessFilesLibrary[i].fsPath}`);
          const output = await lessOpenUI5Builder.build({
            lessInputPath: lessFilesLibrary[i].fsPath,
            library: {
              name: namespace,
            },
          });
          lessOpenUI5Builder.clearCache();

          const cFSPath = lessFilesLibrary[i].fsPath.replace('library.source.less', '');

          aDestPath.forEach(async (destPath) => {
            const cFSPathLibrary = path.join(cFSPath, 'library.css').replace(srcPath, destPath);
            await workspace.fs.writeFile(Uri.file(cFSPathLibrary), Buffer.from(output.css));

            const cFSPathLibraryRTL = path.join(cFSPath, 'library-RTL.css').replace(srcPath, destPath);
            await workspace.fs.writeFile(Uri.file(cFSPathLibraryRTL), Buffer.from(output.cssRtl));

            const cFSPathLibraryParameters = path.join(cFSPath, 'library-parameters.json').replace(srcPath, destPath);
            await workspace.fs.writeFile(
              Uri.file(cFSPathLibraryParameters),
              Buffer.from(JSON.stringify(output.variables))
            );
          });
        }
      }
      //} else {
      // Generate css for components
      const folder = srcPath.split(path.sep).slice(-2, -1);
      const patternLessComponent = new RelativePattern(srcPath, `**/{styles,${folder}}.less`);
      const lessFilesComponent = await workspace.findFiles(patternLessComponent);

      if (lessFilesComponent.length) {
        for (let i = 0; i < lessFilesComponent.length; i++) {
          Log.builder(`Compiling less file from ${lessFilesComponent[i].fsPath}`);
          const lessFile = await workspace.fs.readFile(Uri.file(lessFilesComponent[i].fsPath));
          const output = await less.render(lessFile.toString(), {
            filename: lessFilesComponent[i].fsPath,
          });
          aDestPath.forEach(async (destPath) => {
            const cFSPath = lessFilesComponent[i].fsPath.replace('.less', '.css').replace(srcPath, destPath);
            await workspace.fs.writeFile(Uri.file(cFSPath), Buffer.from(output.css));
          });
        }
      }
      //}
    }
  },

  /**
   * Babelify js files
   */
  async babelifyJSFiles(ui5App: Ui5App, folderPath: string): Promise<void> {
    if (Config.builder('babelSources')) {
      try {
        Log.builder(`Babelify files from ${folderPath}`);
        // Create -dbg files
        const patternJs = new RelativePattern(folderPath, `**/*.js`);
        const babelSourcesExclude = String(Config.builder(`babelSourcesExclude`));
        const jsFiles = await workspace.findFiles(patternJs, babelSourcesExclude);

        //require('core-js');

        for (let i = 0; i < jsFiles.length; i++) {
          const uriOrigJs = Uri.file(jsFiles[i].fsPath);
          const jsFileRaw = await workspace.fs.readFile(uriOrigJs);
          const jsFileString = jsFileRaw.toString();

          const babelified: BabelFileResult | null = await transformAsync(jsFileString, {
            plugins: [
              [
                transformAsyncToPromises,
                {
                  inlineHelpers: true,
                },
              ],
              [transformRemoveConsole],
            ],
            presets: [
              [
                presetEnv,
                {
                  targets: {
                    browsers: 'last 2 versions, ie 11',
                  },
                },
              ],
            ],
          });
          if (babelified && babelified.code && babelified.code !== jsFileString) {
            const babelifiedCode = babelified.code.replace(/\r\n|\r|\n/g, os.EOL);

            await workspace.fs.writeFile(uriOrigJs, Buffer.from(babelifiedCode));
          }
        }
      } catch (error: any) {
        throw new Error(error);
      }
    }
  },

  /**
   * Create -dbg.js files
   */
  async createDebugFiles(ui5App: Ui5App, srcPath: string, folderPath: string): Promise<void> {
    if (Config.builder('debugSources')) {
      try {
        Log.builder(`Create dbg files ${folderPath}`);
        // Create -dbg files
        const patternJs = new RelativePattern(srcPath, `**/*.js`);
        const jsFiles = await workspace.findFiles(patternJs);

        for (let i = 0; i < jsFiles.length; i++) {
          const uriOrigJs = Uri.file(jsFiles[i].fsPath);
          const uriDestJs = Uri.file(jsFiles[i].fsPath.replace(srcPath, folderPath).replace('.js', '-dbg.js'));
          await workspace.fs.copy(uriOrigJs, uriDestJs, {
            overwrite: true,
          });
        }
      } catch (error: any) {
        throw new Error(error);
      }
    }
  },

  /**
   * Compress files from folderPath
   */
  async compressFiles(ui5App: Ui5App, fsPath: string): Promise<void> {
    if (Config.builder('uglifySources')) {
      try {
        Log.builder(`Compress files from ${fsPath}`);

        await this.compressJs(ui5App, fsPath);
        await this.compressJson(ui5App, fsPath);
        await this.compressXml(ui5App, fsPath);
        await this.compressCss(ui5App, fsPath);
      } catch (error: any) {
        throw new Error(error);
      }
    }
  },

  async compressJs(ui5App: Ui5App, fsPath: string): Promise<void> {
    // Compress js files
    const patternJs = new RelativePattern(fsPath, `**/*.js`);
    const uglifySourcesExclude = String(Config.builder(`uglifySourcesExclude`));
    const jsFiles = await workspace.findFiles(patternJs, uglifySourcesExclude);

    for (let i = 0; i < jsFiles.length; i++) {
      const uriOrigJs = Uri.file(jsFiles[i].fsPath);
      const jsFileRaw = await workspace.fs.readFile(uriOrigJs);

      const jsFileMinified: MinifyOutput = await minify(jsFileRaw.toString());
      if (jsFileMinified.code) {
        await workspace.fs.writeFile(uriOrigJs, Buffer.from(jsFileMinified.code));
      }
    }
  },

  async compressJson(ui5App: Ui5App, fsPath: string): Promise<void> {
    // Compress json files
    const patternJson = new RelativePattern(fsPath, `**/*.json`);
    const jsonFiles = await workspace.findFiles(patternJson);

    for (let i = 0; i < jsonFiles.length; i++) {
      const uriOrigJs = Uri.file(jsonFiles[i].fsPath);
      const jsonFileRaw = await workspace.fs.readFile(uriOrigJs);

      const jsFileMinified = prettyData.jsonmin(jsonFileRaw.toString());
      await workspace.fs.writeFile(uriOrigJs, Buffer.from(jsFileMinified));
    }
  },

  async compressXml(ui5App: Ui5App, fsPath: string): Promise<void> {
    // Compress xml files
    const patternXml = new RelativePattern(fsPath, `**/*.xml`);
    const xmlFiles = await workspace.findFiles(patternXml);

    for (let i = 0; i < xmlFiles.length; i++) {
      const uriOrigXml = Uri.file(xmlFiles[i].fsPath);
      const cssFileRaw = await workspace.fs.readFile(uriOrigXml);

      if (!xmlHtmlPrePattern.test(cssFileRaw.toString())) {
        const xmlFileMinified = prettyData.xmlmin(cssFileRaw.toString(), false);
        await workspace.fs.writeFile(uriOrigXml, Buffer.from(xmlFileMinified));
      }
    }
  },

  async compressCss(ui5App: Ui5App, fsPath: string): Promise<void> {
    // Compress css files
    const patternCss = new RelativePattern(fsPath, `**/*.css`);
    const cssFiles = await workspace.findFiles(patternCss);

    for (let i = 0; i < cssFiles.length; i++) {
      const uriOrigCss = Uri.file(cssFiles[i].fsPath);
      const cssFileRaw = await workspace.fs.readFile(uriOrigCss);

      const cssFileMinified = prettyData.cssmin(cssFileRaw.toString());
      await workspace.fs.writeFile(uriOrigCss, Buffer.from(cssFileMinified));
    }
  },

  /**
   * Cleans unneeded uri files
   */
  async cleanFiles(ui5App: Ui5App, folderPath: string): Promise<void> {
    try {
      Log.builder(`Clean files from ${folderPath}`);
      // delete .less
      const patternLess = new RelativePattern(folderPath, `**/*.less`);
      const lessFiles = await workspace.findFiles(patternLess);

      for (let i = 0; i < lessFiles.length; i++) {
        const uriLess = Uri.file(lessFiles[i].fsPath);
        await workspace.fs.delete(uriLess);
      }
    } catch (error: any) {
      throw new Error(error);
    }
  },

  /**
   * Creates component preload
   */
  async createPreload(ui5App: Ui5App, srcPath: string, destPath: string): Promise<void> {
    const { isLibrary, namespace } = ui5App;

    Log.builder(`Create preload into ${destPath}`);
    const sFile = isLibrary ? 'library.js' : 'Component.js';
    const sComponentPath = Uri.file(path.join(srcPath, sFile));

    try {
      await workspace.fs.readFile(sComponentPath);
    } catch (oError) {
      Log.builder(`${sFile} not found in path ${srcPath}, skiping preload creation...`);
      return;
    }

    const { compatVersion } = Utils.getOptionsVersion();
    const namespaceBars = namespace.split('.').join('/');
    const preloadSrc = Config.builder('preloadSrc');
    const uglifyPreload = Config.builder('uglifyPreload');

    await preload({
      resources: {
        cwd: destPath,
        prefix: namespaceBars,
        src: preloadSrc,
      },
      dest: destPath,
      compatVersion: compatVersion,
      compress: uglifyPreload,
      log: false,
      components: !isLibrary ? namespaceBars : false,
      libraries: isLibrary ? namespaceBars : false,
    });
  },
};
