import { workspace, window, RelativePattern, ProgressLocation, Progress, Uri } from 'vscode';
import path from 'path';

import os from 'os';
import preload from 'openui5-preload';
import { minify } from 'terser';
import { pd as prettyData } from 'pretty-data';
import less from 'less';
import lessOpenUI5 from 'less-openui5';

const lessOpenUI5Builder = new lessOpenUI5.Builder({});
const xmlHtmlPrePattern = /<(?:\w+:)?pre>/;

import Utils from '../Utils/Utils';
import Config from '../Utils/Config';

const DEFAULT_TASKS_BUILD = {
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
const DEFAULT_COMPRESS_EXT = { css: true, json: true, xml: true, js: true };

export default {
  /**
   * Open command to project selection
   */
  async askProjectToBuild() {
    let ui5App = undefined;
    try {
      Utils.logOutputBuilder(`Asking project to build`);
      let ui5Apps = await Utils.getAllUI5Apps();
      if (ui5Apps.length > 1) {
        let qpOptions = [];
        ui5Apps.forEach((app) => {
          qpOptions.push({
            label: app.folderName,
            description: app.namespace,
          });
        });
        // ask for a project
        let ui5ProjectToBuild = await new Promise(async (resolve, reject) => {
          let ui5ProjectToBuildQp = await window.createQuickPick();
          ui5ProjectToBuildQp.title = 'ui5-tools > Builder > Select UI5 project';
          ui5ProjectToBuildQp.items = qpOptions;
          ui5ProjectToBuildQp.placeholder = 'Select UI5 project to build';
          ui5ProjectToBuildQp.canSelectMany = false;
          ui5ProjectToBuildQp.onDidAccept(async (args) => {
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
  async buildAllProjects() {
    Utils.logOutputBuilder(`Build all ui5 projects`);
    let ui5Apps = await Utils.getAllUI5Apps();
    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: `ui5-tools > Building all`,
        cancellable: true,
      },
      async (progress, token) => {
        progress.report({ increment: 0 });
        for (let i = 0; i < ui5Apps.length; i++) {
          if (token.isCancellationRequested) {
            return;
          }
          progress.report({
            increment: 100 / ui5Apps.length,
            message: `${ui5Apps[i].folderName} (${i + 1}/${ui5Apps.length})`,
          });
          await this.build(ui5Apps[i], undefined, progress, 0);
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
  async buildProject(ui5App, oTasks, bShowMessage = true) {
    if (ui5App) {
      let folderName = ui5App.folderName;
      Utils.logOutputBuilder(`Building ${folderName}`);
      await window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: `ui5-tools > Building app ${folderName}`,
          cancellable: true,
        },
        async (progress, token) => {
          token.onCancellationRequested(() => {
            throw new Error('Build canceled');
          });

          try {
            await this.build(ui5App, oTasks, progress);

            let sMessage = `Project ${ui5App.folderName} builded!`;
            Utils.logOutputBuilder(sMessage);
            if (bShowMessage) {
              window.showInformationMessage(sMessage);
            }
          } catch (error) {
            throw new Error(error);
          }
        }
      );
    }
  },

  /**
   * Build a project
   * @param {Object} ui5App ui5App
   * @param {Progress|undefined} progress progress options
   */
  async build(ui5App, oTasksParams = DEFAULT_TASKS_BUILD, progress = undefined, multiplier = 1) {
    let folderName = multiplier ? '' : `${ui5App.folderName}`;
    progress?.report({ increment: 0 });

    try {
      let srcFolder = Config.general('srcFolder');
      let libraryFolder = Config.general('libraryFolder');
      let distFolder = Config.general('distFolder');

      if (!srcFolder || !libraryFolder || !distFolder) {
        throw new Error('Invalid srcFolder or libraryFolder');
      }

      let increment = 10 * multiplier;
      progress?.report({ increment: increment, message: `${folderName} Reading manifest` });

      let manifest = ui5App.manifest;

      let srcFsPath = ui5App.srcFsPath;
      let destFsPath = ui5App.distFsPath;

      // Tasks
      let oTasks = {
        ...DEFAULT_TASKS_BUILD,
        ...oTasksParams,
      };
      let {
        cleanFolder,
        copyFolder,
        replaceStrings,
        compileLess,
        babelifyJSFiles,
        compressFiles,
        createDebugFiles,
        cleanFiles,
        createPreload,
      } = oTasks;

      // Config
      replaceStrings = replaceStrings && Config.builder('replaceStrings');
      babelifyJSFiles = babelifyJSFiles && Config.builder('babelSources');
      compressFiles = compressFiles && Config.builder('uglifySources');
      createDebugFiles = createDebugFiles && Config.builder('debugSources');
      createPreload = createPreload && Config.builder('buildPreload');

      // Check that we are not deleting files from srcFolder
      if (srcFsPath === destFsPath) {
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
        await this.cleanFolder(destFsPath);
        increment = 0;
      }

      // copy files
      increment += 10 * multiplier;
      if (copyFolder) {
        progress?.report({ increment: increment, message: `${folderName} Copying files` });
        await this.copyFolder(srcFsPath, destFsPath);
        increment = 0;
      }

      // replace strings
      increment += 10 * multiplier;
      if (replaceStrings) {
        progress?.report({ increment: increment, message: `${folderName} Replacing strings` });
        await this.replaceStrings(destFsPath);
        increment = 0;
      }

      // compile less
      increment += 10 * multiplier;
      if (compileLess) {
        progress?.report({ increment: increment, message: `${folderName} Compile less to css` });
        await this.compileLess(srcFsPath, destFsPath, manifest);
        increment = 0;
      }

      // babel js files
      increment += 5 * multiplier;
      if (babelifyJSFiles) {
        progress?.report({ increment: increment, message: `${folderName} Babelify js files` });
        await this.babelifyJSFiles(destFsPath);
        increment = 0;
      }

      // compress files
      increment += 10 * multiplier;
      if (compressFiles) {
        progress?.report({ increment: increment, message: `${folderName} Compress files` });
        await this.compressFiles(destFsPath);
        increment = 0;
      }

      // create dbg files
      increment += 5 * multiplier;
      if (createDebugFiles) {
        progress?.report({ increment: increment, message: `${folderName} Creating dbg files` });
        await this.createDebugFiles(srcFsPath, destFsPath);
        increment = 0;
      }

      // clean files
      increment += 10 * multiplier;
      if (cleanFiles) {
        progress?.report({ increment: increment, message: `${folderName} Cleaning files` });
        await this.cleanFiles(destFsPath);
        increment = 0;
      }

      // create preload
      increment += 20 * multiplier;
      if (createPreload) {
        progress?.report({ increment: increment, message: `${folderName} Building preload` });
        await this.createPreload(srcFsPath, destFsPath, manifest);
        increment = 0;
      }

      // End build
    } catch (error) {
      throw new Error(error);
    }
    return true;
  },

  /**
   * Deletes folder or file
   * @param {string} folderPath uri folder to delete
   */
  async cleanFolder(folderPath) {
    if (folderPath) {
      let uriToDelete = Uri.file(folderPath);
      Utils.logOutputBuilder(`Deleting ${uriToDelete}`);
      try {
        await workspace.fs.delete(uriToDelete, {
          recursive: true,
          useTrash: true,
        });
      } catch (error) {
        if (error.code !== 'FileNotFound') {
          throw new Error(error);
        }
      }
    }
    return true;
  },

  /**
   * Replace all strings
   * @param {string} folderPath URI folder
   */
  async replaceStrings(folderPath) {
    let replaceExtensions = Config.builder('replaceExtensions');
    let pattern = new RelativePattern(folderPath, `**/*.{${replaceExtensions}}`);
    let files = await workspace.findFiles(pattern);

    const calculedKeys = this.replaceStringsValue();
    const aCalculedKeys = Object.entries(calculedKeys);

    if (files.length) {
      Utils.logOutputBuilder(`Replacing strings to folder ${folderPath}`);
      try {
        for (let i = 0; i < files.length; i++) {
          await this.replaceStringsFile(files[i], aCalculedKeys);
        }
      } catch (error) {
        throw new Error(error);
      }
    }
    return true;
  },

  async replaceStringsFile(file, aCalculedKeys = []) {
    if (file) {
      let rawFile = await workspace.fs.readFile(file);
      let stringfile = rawFile.toString();

      for (const [key, value] of aCalculedKeys) {
        stringfile = stringfile.replace(new RegExp('(<%){1}[\\s]*(' + key + '){1}[\\s]*(%>){1}', 'g'), value);
      }

      await workspace.fs.writeFile(file, Buffer.from(stringfile));
    }
    return true;
  },

  replaceStringsValue() {
    let keysValues = Config.builder('replaceKeysValues');
    let calculedKeys = {};

    let oDate = new Date();
    let sComputedDateKeyBegin = 'COMPUTED_Date_';
    let aDateMethods = Utils.getMethods(oDate);
    let aDateValues = aDateMethods.map((sMethod) => {
      let sKey = `${sComputedDateKeyBegin}${sMethod}`;
      let sValue = '' + oDate[sMethod]().toString();
      return { key: sKey, value: sValue };
    });
    keysValues = keysValues.concat(aDateValues);

    keysValues.forEach(({ key, value }) => {
      if (value.indexOf(sComputedDateKeyBegin) === 0) {
        let sFn = value.replace(sComputedDateKeyBegin, '');
        if (typeof oDate[sFn] == 'function') {
          if (!calculedKeys[key]) {
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
   * @param {string} srcPath uri folder source
   * @param {string} destPath uri folder destination
   */
  async copyFolder(srcPath, destPath) {
    let uriSrc = Uri.file(srcPath);
    let uriDest = Uri.file(destPath);
    Utils.logOutputBuilder(`Copying folder ${uriSrc} to ${uriDest}`);
    try {
      await workspace.fs.copy(uriSrc, uriDest, {
        overwrite: true,
      });
    } catch (error) {
      throw new Error(error);
    }
    return true;
  },

  /**
   * Compile less from destPath
   * @param {string} srcPath uri source path
   * @param {Array} aDestPath uri dest path
   * @param {object|undefined} manifest manifest object
   */
  async compileLess(srcPath, aDestPath = [], manifest = undefined) {
    if (typeof aDestPath === 'string' && aDestPath) {
      aDestPath = [aDestPath];
    }
    if (aDestPath && aDestPath.length) {
      if (!manifest) {
        manifest = await Utils.getManifest(srcPath);
      }
      //let isLibrary = await Utils.getManifestLibrary(manifest);
      let namespace = await Utils.getManifestId(manifest);

      //if (isLibrary) {
      // Generate css for library
      let patternLessLibrary = new RelativePattern(srcPath, `**/library.source.less`);
      let lessFilesLibrary = await workspace.findFiles(patternLessLibrary);
      if (lessFilesLibrary.length) {
        for (let i = 0; i < lessFilesLibrary.length; i++) {
          Utils.logOutputBuilder(`Compiling less theme ${lessFilesLibrary[i].fsPath}`);
          let output = await lessOpenUI5Builder.build({
            lessInputPath: lessFilesLibrary[i].fsPath,
            // @ts-ignore
            library: {
              name: namespace,
            },
          });
          lessOpenUI5Builder.clearCache();

          let cFSPath = lessFilesLibrary[i].fsPath.replace('library.source.less', '');

          aDestPath.forEach(async (destPath) => {
            let cFSPathLibrary = path.join(cFSPath, 'library.css').replace(srcPath, destPath);
            await workspace.fs.writeFile(Uri.file(cFSPathLibrary), Buffer.from(output.css));

            let cFSPathLibraryRTL = path.join(cFSPath, 'library-RTL.css').replace(srcPath, destPath);
            await workspace.fs.writeFile(Uri.file(cFSPathLibraryRTL), Buffer.from(output.cssRtl));

            let cFSPathLibraryParameters = path.join(cFSPath, 'library-parameters.json').replace(srcPath, destPath);
            await workspace.fs.writeFile(
              Uri.file(cFSPathLibraryParameters),
              Buffer.from(JSON.stringify(output.variables))
            );
          });
        }
      }
      //} else {
      // Generate css for components
      let folder = srcPath.split(path.sep).slice(-2, -1);
      let patternLessComponent = new RelativePattern(srcPath, `**/{styles,${folder}}.less`);
      let lessFilesComponent = await workspace.findFiles(patternLessComponent);

      if (lessFilesComponent.length) {
        for (let i = 0; i < lessFilesComponent.length; i++) {
          Utils.logOutputBuilder(`Compiling less file ${lessFilesComponent[i].fsPath}`);
          let lessFile = await workspace.fs.readFile(Uri.file(lessFilesComponent[i].fsPath));
          let output = await less.render(lessFile.toString(), {
            filename: lessFilesComponent[i].fsPath,
          });
          aDestPath.forEach(async (destPath) => {
            let cFSPath = lessFilesComponent[i].fsPath.replace('.less', '.css').replace(srcPath, destPath);
            await workspace.fs.writeFile(Uri.file(cFSPath), Buffer.from(output.css));
          });
        }
      }
      //}
    }
    return true;
  },

  /**
   * Babelify js files
   * @param {string} folderPath folder uri
   */
  async babelifyJSFiles(folderPath) {
    if (Config.builder('babelSources') || true) {
      try {
        Utils.logOutputBuilder(`Babelify files ${folderPath}`);
        // Create -dbg files
        let patternJs = new RelativePattern(folderPath, `**/*.js`);
        let babelSourcesExclude = Config.builder(`babelSourcesExclude`) || '';
        let jsFiles = await workspace.findFiles(patternJs, babelSourcesExclude);
        //@ts-ignore
        let babelCore = require('@babel/core');
        //@ts-ignore
        let transformAsyncToPromises = require('babel-plugin-transform-async-to-promises');
        //@ts-ignore
        let transformRemoveConsole = require('babel-plugin-transform-remove-console');
        //@ts-ignore
        let presetEnv = require('@babel/preset-env');
        //@ts-ignore
        //require('core-js');

        for (let i = 0; i < jsFiles.length; i++) {
          let uriOrigJs = Uri.file(jsFiles[i].fsPath);
          let jsFileRaw = await workspace.fs.readFile(uriOrigJs);

          let babelified = await babelCore.transformAsync(jsFileRaw.toString(), {
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
          let babelifiedCode = babelified.code.replace(/\r\n|\r|\n/g, os.EOL);

          await workspace.fs.writeFile(uriOrigJs, Buffer.from(babelifiedCode));
        }
      } catch (error) {
        throw new Error(error);
      }
    }
    return true;
  },

  /**
   * Create -dbg.js files
   * @param {string} srcPath uri source path
   * @param {string} folderPath folder uri
   */
  async createDebugFiles(srcPath, folderPath) {
    if (Config.builder('debugSources')) {
      try {
        Utils.logOutputBuilder(`Create dbg files ${folderPath}`);
        // Create -dbg files
        let patternJs = new RelativePattern(srcPath, `**/*.js`);
        let jsFiles = await workspace.findFiles(patternJs);

        for (let i = 0; i < jsFiles.length; i++) {
          let uriOrigJs = Uri.file(jsFiles[i].fsPath);
          let uriDestJs = Uri.file(jsFiles[i].fsPath.replace(srcPath, folderPath).replace('.js', '-dbg.js'));
          await workspace.fs.copy(uriOrigJs, uriDestJs, {
            overwrite: true,
          });
        }
      } catch (error) {
        throw new Error(error);
      }
    }
    return true;
  },

  /**
   * Compress files from folderPath
   * @param {string} folderPath uri folder path
   */
  async compressFiles(folderPath, oOptionsParams = DEFAULT_COMPRESS_EXT) {
    if (Config.builder('uglifySources')) {
      let oOptions = {
        ...DEFAULT_TASKS_BUILD,
        ...oOptionsParams,
      };
      try {
        Utils.logOutputBuilder(`Compres files to ${folderPath}`);
        if (oOptions.js) {
          // Compress js files
          let patternJs = new RelativePattern(folderPath, `**/*.js`);
          let uglifySourcesExclude = Config.builder(`uglifySourcesExclude`) || '';
          let jsFiles = await workspace.findFiles(patternJs, uglifySourcesExclude);

          for (let i = 0; i < jsFiles.length; i++) {
            let uriOrigJs = Uri.file(jsFiles[i].fsPath);
            let jsFileRaw = await workspace.fs.readFile(uriOrigJs);

            let jsFileMinified = await minify(jsFileRaw.toString());
            await workspace.fs.writeFile(uriOrigJs, Buffer.from(jsFileMinified.code));
          }
        }

        if (oOptions.json) {
          // Compress json files
          let patternJson = new RelativePattern(folderPath, `**/*.json`);
          let jsonFiles = await workspace.findFiles(patternJson);

          for (let i = 0; i < jsonFiles.length; i++) {
            let uriOrigJs = Uri.file(jsonFiles[i].fsPath);
            let jsonFileRaw = await workspace.fs.readFile(uriOrigJs);

            let jsFileMinified = prettyData.jsonmin(jsonFileRaw.toString());
            await workspace.fs.writeFile(uriOrigJs, Buffer.from(jsFileMinified));
          }
        }

        if (oOptions.xml) {
          // Compress xml files
          let patternXml = new RelativePattern(folderPath, `**/*.xml`);
          let xmlFiles = await workspace.findFiles(patternXml);

          for (let i = 0; i < xmlFiles.length; i++) {
            let uriOrigXml = Uri.file(xmlFiles[i].fsPath);
            let cssFileRaw = await workspace.fs.readFile(uriOrigXml);

            if (!xmlHtmlPrePattern.test(cssFileRaw.toString())) {
              let xmlFileMinified = prettyData.xmlmin(cssFileRaw.toString(), false);
              await workspace.fs.writeFile(uriOrigXml, Buffer.from(xmlFileMinified));
            }
          }
        }

        if (oOptions.css) {
          // Compress css files
          let patternCss = new RelativePattern(folderPath, `**/*.css`);
          let cssFiles = await workspace.findFiles(patternCss);

          for (let i = 0; i < cssFiles.length; i++) {
            let uriOrigCss = Uri.file(cssFiles[i].fsPath);
            let cssFileRaw = await workspace.fs.readFile(uriOrigCss);

            let cssFileMinified = prettyData.cssmin(cssFileRaw.toString());
            await workspace.fs.writeFile(uriOrigCss, Buffer.from(cssFileMinified));
          }
        }
      } catch (error) {
        throw new Error(error);
      }
    }
    return true;
  },

  /**
   * Cleans unneeded uri files
   * @param {string} folderPath folder uri
   */
  async cleanFiles(folderPath) {
    try {
      Utils.logOutputBuilder(`Clean files from ${folderPath}`);
      // delete .less
      let patternLess = new RelativePattern(folderPath, `**/*.less`);
      let lessFiles = await workspace.findFiles(patternLess);

      for (let i = 0; i < lessFiles.length; i++) {
        let uriLess = Uri.file(lessFiles[i].fsPath);
        await workspace.fs.delete(uriLess);
      }
    } catch (error) {
      throw new Error(error);
    }
    return true;
  },

  /**
   * Creates component preload
   * @param {string} destPath uri folder source
   * @param {string} destPath uri folder destination
   * @param {object} manifest manifest file
   */
  async createPreload(srcPath, destPath, manifest) {
    if (!manifest) {
      manifest = await Utils.getManifest(srcPath);
    }
    let idApp = await Utils.getManifestId(manifest);
    let isLibrary = await Utils.getManifestLibrary(manifest);

    Utils.logOutputBuilder(`Create preload ${srcPath}`);
    let sFile = isLibrary ? 'library.js' : 'Component.js';
    let sComponentPath = Uri.file(path.join(srcPath, sFile));

    try {
      await workspace.fs.readFile(sComponentPath);
    } catch (oError) {
      Utils.logOutputBuilder(`${sFile} not found in path ${srcPath}, skiping preload creation...`);
      return;
    }

    let { compatVersion } = Utils.getOptionsVersion();
    let namespace = idApp.split('.').join('/');
    let preloadSrc = Config.builder('preloadSrc');
    let uglifyPreload = Config.builder('uglifyPreload');

    await preload({
      resources: {
        cwd: destPath,
        prefix: namespace,
        src: preloadSrc,
      },
      dest: destPath,
      compatVersion: compatVersion,
      compress: uglifyPreload,
      log: false,
      components: !isLibrary ? namespace : false,
      libraries: isLibrary ? namespace : false,
    });
  },
};
