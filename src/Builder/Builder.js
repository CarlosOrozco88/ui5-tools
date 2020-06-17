import { workspace, window, RelativePattern, ProgressLocation, Progress, Uri, TextDocument } from 'vscode';
import path from 'path';

import preload from 'openui5-preload';
import terser from 'terser';
import { pd as prettyData } from 'pretty-data';
import less from 'less';
import lessOpenUI5 from 'less-openui5';
import { setTimeout } from 'timers';
const lessOpenUI5Builder = new lessOpenUI5.Builder({});
const xmlHtmlPrePattern = /<(?:\w+:)?pre>/;

import Utils from '../Utils/Utils';
import Config from '../Utils/Config';

export default {
  /**
   * Open command to project selection
   */
  async askProjectToBuild() {
    let ui5App = undefined;
    try {
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
        let ui5ProjectToBuild = await window.showQuickPick(qpOptions, {
          placeHolder: 'Select UI5 project to build',
          canPickMany: false,
        });

        // fspath from selected project
        ui5App = ui5Apps.find((app) => {
          return app.namespace == ui5ProjectToBuild.description;
        });
      } else if (ui5Apps.length == 1) {
        // only one project
        ui5App = ui5Apps[0];
      }
    } catch (e) {
      ui5App = undefined;
    }
    await this.buildProject(ui5App);
  },

  /**
   * Build all workspace projects
   */
  async buildAllProjects() {
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
            message: `${ui5Apps[i].folderName}`,
          });
          await this.build(ui5Apps[i], progress, 0);
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
  async buildProject(ui5App) {
    if (ui5App) {
      let folderName = ui5App.folderName;
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
            await this.build(ui5App, progress);
          } catch (error) {
            throw new Error(error);
          }
        }
      );
    }
  },

  /**
   * Checks valid configuration
   */
  checkValidSrcLibraryDistConfig() {
    let srcFolder = Config.general('srcFolder');
    let libraryFolder = Config.general('libraryFolder');
    let distFolder = Config.general('distFolder');
    let valid = true;
    if (!srcFolder || !libraryFolder || !distFolder || srcFolder === distFolder || libraryFolder === distFolder) {
      valid = false;
    }
    return valid;
  },

  /**
   * Build a project
   * @param {Object} ui5App ui5App
   * @param {Progress|undefined} progress progress options
   */
  async build(ui5App, progress = undefined, multiplier = 1) {
    let folderName = multiplier ? '' : `${ui5App.folderName} `;
    progress?.report({ increment: 0 });

    try {
      if (!this.checkValidSrcLibraryDistConfig()) {
        throw new Error('Invalid srcFolder, libraryFolder or distFolder');
      }

      let message = `Reading manifest`;
      progress?.report({ increment: 10 * multiplier, message: `${folderName}${message}` });

      let manifest = ui5App.manifest;

      let srcPath = ui5App.srcFsPath;
      let destPath = ui5App.distFsPath;

      // clean dist folder
      message = `Cleaning dist folder`;
      progress?.report({ increment: 10 * multiplier, message: `${folderName}${message}` });
      await this.cleanFolder(destPath);

      // copy files
      message = `Copying files`;
      progress?.report({ increment: 10 * multiplier, message: `${folderName}${message}` });
      await this.copyFolder(srcPath, destPath);

      // replace strings
      let bReplaceStrings = Config.builder('replaceStrings');
      message = bReplaceStrings ? `Replacing strings` : message;
      if (bReplaceStrings) {
        await this.replaceStrings(destPath);
      }

      // compile less
      message = `Compile less to css`;
      progress?.report({ increment: 10 * multiplier, message: `${folderName}${message}` });
      await this.compileLess(srcPath, destPath, manifest);

      // create dbg files
      let bDebugSources = Config.builder('debugSources');
      message = bDebugSources ? `Creating dbg files` : message;
      progress?.report({ increment: 10 * multiplier, message: `${folderName}${message}` });
      if (bDebugSources) {
        await this.createDebugFiles(destPath);
      }

      // compress files
      let bUglifySources = Config.builder('uglifySources');
      message = bUglifySources ? `Compress files` : message;
      progress?.report({ increment: 10 * multiplier, message: `${folderName}${message}` });
      if (bUglifySources) {
        await this.compressFiles(destPath);
      }

      // clean files
      message = `Cleaning files`;
      progress?.report({ increment: 10 * multiplier, message: `${folderName}${message}` });
      await this.cleanFiles(destPath);

      // create preload
      message = `Building preload`;
      progress?.report({ increment: 20 * multiplier, message: `${folderName}${message}` });
      await this.createPreload(srcPath, destPath, manifest);

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
   * @param {string} folderPath uri folder
   */
  async replaceStrings(folderPath) {
    let replaceExtensions = Config.builder('replaceExtensions');
    let pattern = new RelativePattern(folderPath, `**/*.{${replaceExtensions}}`);
    let files = await workspace.findFiles(pattern);

    let calculedKeys = {};
    if (files.length) {
      try {
        for (let i = 0; i < files.length; i++) {
          await this.replaceStringsFile(files[i], calculedKeys);
        }
      } catch (error) {
        throw new Error(error);
      }
    }
    return true;
  },

  async replaceStringsFile(file, calculedKeys = {}) {
    let keysValues = Config.builder('replaceKeysValues');

    let rawFile = await workspace.fs.readFile(file);
    let stringfile = rawFile.toString();
    keysValues.forEach((replacement) => {
      let { key, value } = this.replaceStringsValue(replacement, calculedKeys);

      stringfile = stringfile.replace(new RegExp('(<%){1}[\\s]*(' + key + '){1}[\\s]*(%>){1}', 'g'), value.toString());
    });

    await workspace.fs.writeFile(file, Buffer.from(stringfile));
    return true;
  },

  replaceStringsValue({ key, value = '' }, calculedKeys) {
    if (value.indexOf('COMPUTED_') === 0) {
      switch (key.replace('COMPUTED_', '')) {
        case 'TIMESTAMP':
          if (!calculedKeys[key]) {
            calculedKeys[key] = new Date().getTime();
          }
          value = calculedKeys[key];
          break;
      }
    }
    return { key, value };
  },

  /**
   * Copies srcPath to destPath
   * @param {string} srcPath uri folder source
   * @param {string} destPath uri folder destination
   */
  async copyFolder(srcPath, destPath) {
    let uriSrc = Uri.file(srcPath);
    let uriDest = Uri.file(destPath);
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
   * @param {string} destPath uri dest path
   * @param {object|undefined} manifest manifest object
   */
  async compileLess(srcPath, destPath, manifest = undefined) {
    if (destPath) {
      if (!manifest) {
        manifest = await Utils.getManifest(srcPath);
      }
      let isLibrary = await Utils.getManifestLibrary(manifest);
      let namespace = await Utils.getManifestId(manifest);

      if (isLibrary) {
        // Generate css for library
        let patternLess = new RelativePattern(destPath, `**/library.source.less`);
        let lessFiles = await workspace.findFiles(patternLess);
        if (lessFiles.length) {
          for (let i = 0; i < lessFiles.length; i++) {
            let output = await lessOpenUI5Builder.build({
              lessInputPath: lessFiles[i].fsPath,
              // @ts-ignore
              library: {
                name: namespace,
              },
            });
            lessOpenUI5Builder.clearCache();

            let cFSPath = lessFiles[i].fsPath.replace('library.source.less', '');

            let cFSPathLibrary = path.join(cFSPath, 'library.css');
            await workspace.fs.writeFile(Uri.file(cFSPathLibrary), Buffer.from(output.css));

            let cFSPathLibraryRTL = path.join(cFSPath, 'library-RTL.css');
            await workspace.fs.writeFile(Uri.file(cFSPathLibraryRTL), Buffer.from(output.cssRtl));

            let cFSPathLibraryParameters = path.join(cFSPath, 'library-parameters.json');
            await workspace.fs.writeFile(Uri.file(cFSPathLibraryParameters), Buffer.from(output.variables.toString()));
          }
        }
      } else {
        // Generate css for components
        let folder = destPath.split(path.sep).slice(-2, -1);
        let patternLess = new RelativePattern(destPath, `**/{styles,${folder}}.less`);
        let lessFiles = await workspace.findFiles(patternLess);

        if (lessFiles.length) {
          for (let i = 0; i < lessFiles.length; i++) {
            let lessFile = await workspace.fs.readFile(Uri.file(lessFiles[i].fsPath));
            let output = await less.render(lessFile.toString(), {
              filename: lessFiles[i].fsPath,
            });
            let cFSPath = lessFiles[i].fsPath.replace('.less', '.css');
            await workspace.fs.writeFile(Uri.file(cFSPath), Buffer.from(output.css));
          }
        }
      }
    }
    return true;
  },

  /**
   * Create -dbg.js files
   * @param {string} folderPath folder uri
   */
  async createDebugFiles(folderPath) {
    if (Config.builder('debugSources')) {
      try {
        // Create -dbg files
        let patternJs = new RelativePattern(folderPath, `**/*.js`);
        let jsFiles = await workspace.findFiles(patternJs);

        for (let i = 0; i < jsFiles.length; i++) {
          let uriOrigJs = Uri.file(jsFiles[i].fsPath);
          let uriDestJs = Uri.file(jsFiles[i].fsPath.replace('.js', '-dbg.js'));
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
  async compressFiles(folderPath) {
    if (Config.builder('uglifySources')) {
      try {
        // Compress js files
        let patternJs = new RelativePattern(folderPath, `**/*.js`);
        let jsFiles = await workspace.findFiles(patternJs, `**/*-dbg.js`);

        for (let i = 0; i < jsFiles.length; i++) {
          let uriOrigJs = Uri.file(jsFiles[i].fsPath);
          let jsFileRaw = await workspace.fs.readFile(uriOrigJs);
          let jsFileMinified = terser.minify(jsFileRaw.toString());

          if (jsFileMinified.error) {
            throw jsFileMinified.error;
          } else {
            await workspace.fs.writeFile(uriOrigJs, Buffer.from(jsFileMinified.code));
          }
        }

        // Compress json files
        let patternJson = new RelativePattern(folderPath, `**/*.json`);
        let jsonFiles = await workspace.findFiles(patternJson);

        for (let i = 0; i < jsonFiles.length; i++) {
          let uriOrigJs = Uri.file(jsonFiles[i].fsPath);
          let jsonFileRaw = await workspace.fs.readFile(uriOrigJs);

          let jsFileMinified = prettyData.jsonmin(jsonFileRaw.toString());
          await workspace.fs.writeFile(uriOrigJs, Buffer.from(jsFileMinified));
        }

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

        // Compress css files
        let patternCss = new RelativePattern(folderPath, `**/*.css`);
        let cssFiles = await workspace.findFiles(patternCss);

        for (let i = 0; i < cssFiles.length; i++) {
          let uriOrigCss = Uri.file(cssFiles[i].fsPath);
          let cssFileRaw = await workspace.fs.readFile(uriOrigCss);

          let cssFileMinified = prettyData.cssmin(cssFileRaw.toString(), false);
          await workspace.fs.writeFile(uriOrigCss, Buffer.from(cssFileMinified));
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

    return new Promise((resolv, reject) => {
      setTimeout(() => {
        try {
          let { compatVersion } = Utils.getOptionsVersion();
          let namespace = idApp.split('.').join('/');
          preload({
            resources: {
              cwd: destPath,
              prefix: namespace,
            },
            dest: destPath,
            compatVersion: compatVersion,
            compress: true,
            log: false,
            components: !isLibrary ? namespace : false,
            libraries: isLibrary ? namespace : false,
          });
        } catch (error) {
          reject(error);
        }
        resolv(true);
      }, 1);
    });
  },

  /**
   * Live compile less to css
   * @param {TextDocument} event save file event
   */
  async liveCompileLess(event) {
    let buildLess = Config.builder('buildLess');
    if (buildLess) {
      let { fileName } = event;
      let extension = path.extname(fileName).replace('.', '');
      if (extension === 'less') {
        let ui5Apps = await Utils.getAllUI5Apps();

        let ui5App = ui5Apps.find((ui5App) => {
          let cPath = ui5App.appFsPath;
          return fileName.indexOf(cPath) === 0;
        });

        if (ui5App) {
          await window.withProgress(
            {
              location: ProgressLocation.Notification,
              title: `ui5-tools > Building css files for`,
              cancellable: true,
            },
            async (progress, token) => {
              progress.report({ message: ui5App.folderName });
              await this.compileLess(ui5App.srcFsPath, ui5App.srcFsPath, ui5App.manifest);
            }
          );
        }
      }
    }
  },
};
