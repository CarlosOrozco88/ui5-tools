import { workspace, window, RelativePattern, ProgressLocation, Progress, Uri } from 'vscode';

import path from 'path';

import Utils from '../Utils/Utils';
import preload from 'openui5-preload';
import terser from 'terser';
import { pd as prettyData } from 'pretty-data';
import less from 'less';
import lessOpenUI5 from 'less-openui5';
import { setTimeout } from 'timers';
const lessOpenUI5Builder = new lessOpenUI5.Builder();
const xmlHtmlPrePattern = /<(?:\w+:)?pre>/;

/**
 * Open command to project selection
 */
async function askProjectToBuild() {
  Utils.loadConfig();
  let projectPath = undefined;
  try {
    let { foldersWithName } = Utils.getConfig();
    let qpOptions = [];
    foldersWithName.forEach((folder) => {
      qpOptions.push({
        description: folder.uri.fsPath != folder.name ? path.sep + folder.uri.fsPath.split(path.sep).pop() : '',
        label: folder.name,
      });
    });
    if (qpOptions.length > 1) {
      // Add all options
      qpOptions.push({
        description: 'Build all UI5 projects',
        label: 'ALL',
      });

      // ask for a project
      let ui5ProjectToBuild = await window.showQuickPick(qpOptions, {
        placeHolder: 'Select UI5 project to build',
        canPickMany: false,
      });

      // check selected project
      if (ui5ProjectToBuild.label === 'ALL') {
        // all projects
        projectPath = 'ALL';
      } else {
        // fspath from selected project
        projectPath = foldersWithName.filter((folder) => {
          return folder.name == ui5ProjectToBuild.label;
        })[0].uri.fsPath;
      }
    } else if (qpOptions.length == 1) {
      // only one project
      projectPath = qpOptions[0].uri.fsPath;
    }
  } catch (e) {
    projectPath = undefined;
  }
  if (projectPath === 'ALL') {
    await buildAllProjects();
  } else if (projectPath) {
    await buildProject(projectPath);
  }
}

/**
 * Build all workspace projects
 */
async function buildAllProjects() {
  let { foldersWithName } = Utils.getConfig();
  await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: `ui5-tools > Building all apps`,
      cancellable: true,
    },
    async (progress, token) => {
      progress.report({ increment: 0 });
      for (let i = 0; i < foldersWithName.length; i++) {
        if (token.isCancellationRequested) {
          return;
        }
        progress.report({
          increment: 100 / foldersWithName.length,
          message: `${foldersWithName[i].name}`,
        });
        await buildProject(foldersWithName[i].uri.fsPath);
      }
      return;
    }
  );
  return;
}

/**
 * Open window withprogress to build project
 * @param {string} projectPath uri from project path
 */
async function buildProject(projectPath) {
  if (projectPath) {
    let folderName = projectPath.split(path.sep).pop();
    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: `ui5-tools > Building app ${folderName}`,
        cancellable: true,
      },
      async function (progress, token) {
        token.onCancellationRequested(() => {
          throw new Error('Build canceled');
        });

        try {
          await build(projectPath, progress);
        } catch (error) {
          throw new Error(error);
        }
      }
    );
  }
}

/**
 * Checks valid configuration
 */
function checkValidSrcLibraryDistConfig() {
  let srcFolder = Utils.getConfigurationGeneral('srcFolder');
  let libraryFolder = Utils.getConfigurationGeneral('libraryFolder');
  let distFolder = Utils.getConfigurationGeneral('distFolder');
  let valid = true;
  if (!srcFolder || !libraryFolder || !distFolder || srcFolder === distFolder || libraryFolder === distFolder) {
    valid = false;
  }
  return valid;
}

/**
 * Build a project
 * @param {string} projectPath root path from project
 * @param {Progress|undefined} progress progress options
 */
async function build(projectPath, progress = undefined) {
  progress?.report({ increment: 0 });

  try {
    if (!checkValidSrcLibraryDistConfig()) {
      throw new Error('Invalid srcFolder, libraryFolder or distFolder');
    }

    let increment = 10;
    let message = `Reading manifest`;
    progress?.report({ increment, message });
    let srcFolder = Utils.getConfigurationGeneral('srcFolder');
    let libraryFolder = Utils.getConfigurationGeneral('libraryFolder');
    let distFolder = Utils.getConfigurationGeneral('distFolder');

    let manifest = await Utils.getManifest(projectPath);
    let isLibrary = await Utils.getManifestLibrary(manifest);

    let srcPath = path.join(projectPath, isLibrary ? libraryFolder : srcFolder);
    let destPath = path.join(projectPath, distFolder);

    // clean dist folder
    increment = 10;
    message = `Cleaning dist folder`;
    progress?.report({ increment, message });
    await cleanFolder(destPath);

    // copy files
    increment = 10;
    message = `Copying files`;
    progress?.report({ increment, message });
    await copyFolder(srcPath, destPath);

    // replace strings
    increment = 10;
    if (Utils.getConfigurationBuilder('replaceStrings')) {
      message = `Replacing strings`;
      progress?.report({ increment, message });
      await replaceStrings(destPath);
    } else {
      progress?.report({ increment, message });
    }

    // compile less
    increment = 10;
    message = `Compile less to css`;
    progress?.report({ increment, message });
    await compileLess(srcPath, destPath, manifest);

    // create dbg files
    increment = 10;
    if (Utils.getConfigurationBuilder('debugSources')) {
      message = `Creating dbg files`;
      progress?.report({ increment, message });
      await createDebugFiles(destPath);
    } else {
      progress?.report({ increment, message });
    }

    // compress files
    increment = 10;
    if (Utils.getConfigurationBuilder('uglifySources')) {
      message = `Compress files`;
      progress?.report({ increment, message });
      await compressFiles(destPath);
    } else {
      progress?.report({ increment, message });
    }

    // clean files
    increment = 10;
    message = `Cleaning files`;
    progress?.report({ increment, message });
    await cleanFiles(destPath);

    // create preload
    increment = 20;
    message = `Building preload`;
    progress?.report({ increment, message });
    await createPreload(srcPath, destPath, manifest);

    // End build
  } catch (error) {
    throw new Error(error);
  }
  return true;
}

/**
 * Deletes folder or file
 * @param {string} folderPath uri folder to delete
 */
async function cleanFolder(folderPath) {
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
}

/**
 * Replace all strings
 * @param {string} folderPath uri folder
 */
async function replaceStrings(folderPath) {
  let replaceExtensions = Utils.getConfigurationBuilder('replaceExtensions');
  let pattern = new RelativePattern(folderPath, `**/*.{${replaceExtensions}}`);
  let files = await workspace.findFiles(pattern);

  let calculedKeys = {};
  if (files.length) {
    try {
      for (let i = 0; i < files.length; i++) {
        await replaceStringsFile(files[i], calculedKeys);
      }
    } catch (error) {
      throw new Error(error);
    }
  }
  return true;
}

async function replaceStringsFile(file, calculedKeys = {}) {
  let keysValues = Utils.getConfigurationBuilder('replaceKeysValues');

  let rawFile = await workspace.fs.readFile(file);
  let stringfile = rawFile.toString();
  keysValues.forEach((replacement) => {
    let { key, value } = replaceStringsValue(replacement, calculedKeys);

    stringfile = stringfile.replace(new RegExp('(<%){1}[\\s]*(' + key + '){1}[\\s]*(%>){1}', 'g'), value.toString());
  });

  await workspace.fs.writeFile(file, Buffer.from(stringfile));
  return true;
}

function replaceStringsValue({ key, value = '' }, calculedKeys) {
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
}

/**
 * Copies srcPath to destPath
 * @param {string} srcPath uri folder source
 * @param {string} destPath uri folder destination
 */
async function copyFolder(srcPath, destPath) {
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
}

/**
 * Compile less from destPath
 * @param {string} srcPath uri source path
 * @param {string} destPath uri dest path
 * @param {object|undefined} manifest manifest object
 */
async function compileLess(srcPath, destPath, manifest = undefined) {
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
          let cFSPath = lessFiles[i].fsPath.replace('library.source.less', '');
          await workspace.fs.writeFile(Uri.file(path.join(cFSPath, 'library.css')), Buffer.from(output.css));
          await workspace.fs.writeFile(Uri.file(path.join(cFSPath, 'library-RTL.css')), Buffer.from(output.cssRtl));
          await workspace.fs.writeFile(
            Uri.file(path.join(cFSPath, 'library-parameters.json')),
            Buffer.from(output.variables.toString())
          );
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
}

/**
 * Create -dbg.js files
 * @param {string} folderPath folder uri
 */
async function createDebugFiles(folderPath) {
  if (Utils.getConfigurationBuilder('debugSources')) {
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
}

/**
 * Compress files from folderPath
 * @param {string} folderPath uri folder path
 */
async function compressFiles(folderPath) {
  if (Utils.getConfigurationBuilder('uglifySources')) {
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
          let xmlFileMinified = prettyData.xmlmin(cssFileRaw.toString());
          await workspace.fs.writeFile(uriOrigXml, Buffer.from(xmlFileMinified));
        }
      }

      // Compress css files
      let patternCss = new RelativePattern(folderPath, `**/*.css`);
      let cssFiles = await workspace.findFiles(patternCss);

      for (let i = 0; i < cssFiles.length; i++) {
        let uriOrigCss = Uri.file(cssFiles[i].fsPath);
        let cssFileRaw = await workspace.fs.readFile(uriOrigCss);

        let cssFileMinified = prettyData.cssmin(cssFileRaw.toString());
        await workspace.fs.writeFile(uriOrigCss, Buffer.from(cssFileMinified));
      }
    } catch (error) {
      throw new Error(error);
    }
  }
  return true;
}

/**
 * Cleans unneeded uri files
 * @param {string} folderPath folder uri
 */
async function cleanFiles(folderPath) {
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
}

/**
 *
 * @param {string} destPath uri folder source
 * @param {string} destPath uri folder destination
 * @param {object} manifest manifest file
 */
function createPreload(srcPath, destPath, manifest) {
  return new Promise((resolv, reject) => {
    setTimeout(async function () {
      try {
        if (!manifest) {
          manifest = await Utils.getManifest(srcPath);
        }
        let idApp = await Utils.getManifestId(manifest);
        let isLibrary = await Utils.getManifestLibrary(manifest);
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
          verbose: false,
          components: !isLibrary ? namespace : false,
          libraries: isLibrary ? namespace : false,
        });
      } catch (error) {
        reject(error);
      }
      resolv(true);
    }, 1);
  });
}

async function liveCompileLess(event) {
  let buildLess = Utils.getConfigurationBuilder('buildLess');
  if (buildLess) {
    let { fileName, languageId } = event;
    if (languageId === 'less') {
      let { foldersWithName } = Utils.loadConfig();

      let projectPath = foldersWithName.find((folder) => {
        let cPath = `${folder.uri.fsPath}${path.sep}`;
        return fileName.indexOf(cPath) === 0;
      });

      if (projectPath) {
        let srcFolder = Utils.getConfigurationGeneral('srcFolder');
        let libraryFolder = Utils.getConfigurationGeneral('libraryFolder');

        let manifest = await Utils.getManifest(projectPath.uri.fsPath);
        let isLibrary = await Utils.getManifestLibrary(manifest);
        let srcAndDistPath = path.join(projectPath.uri.fsPath, isLibrary ? libraryFolder : srcFolder);
        let folder = srcAndDistPath.split(path.sep).slice(-2, -1);

        await window.withProgress(
          {
            location: ProgressLocation.Notification,
            title: `ui5-tools > Building css files for`,
            cancellable: true,
          },
          async (progress, token) => {
            progress.report({ message: folder.toString() });
            await compileLess(srcAndDistPath, srcAndDistPath);
          }
        );
      }
    }
  }
}

export default {
  askProjectToBuild,
  liveCompileLess,
};
