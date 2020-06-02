import { workspace } from 'vscode';
import path from 'path';
import fs from 'fs';

let config = {};

function getConfiguration(tool = '') {
  if (tool) {
    tool = '.' + tool;
  }
  return workspace.getConfiguration('ui5-tools' + tool);
}

function getConfigurationProperty(property, tool = '') {
  if (property) {
    return getConfiguration(tool).get(property);
  }
  return getConfiguration(tool);
}

function getConfigurationGeneral(property) {
  return getConfigurationProperty(property);
}

function getConfigurationServer(property) {
  return getConfigurationProperty(property, 'server');
}
function getConfigurationBuilder(property) {
  return getConfigurationProperty(property, 'builder');
}

function getRoot() {
  let baseDir = workspace.rootPath;
  if (baseDir) {
    let doSplit = true;
    if (workspace.workspaceFolders.length == 1) {
      let p = workspace.workspaceFolders[0].uri.fsPath;
      if (p === baseDir) {
        doSplit = false;
      }
    }
    if (doSplit) {
      let arr = baseDir.split(path.sep);
      arr.pop();
      baseDir = arr.join(path.sep);
    }
  }
  return baseDir;
}

function loadConfig(restarting = false) {
  let srcFolder = getConfigurationGeneral('srcFolder');
  let distFolder = getConfigurationGeneral('distFolder');
  let ui5Version = getConfigurationGeneral('ui5Version');

  let serverName = getConfigurationServer('name');
  let port = getConfigurationServer('port');
  let openBrowser = getConfigurationServer('openBrowser');
  let watch = getConfigurationServer('watch');
  let watchExtensions = getConfigurationServer('watchExtensions');
  let odataProxy = getConfigurationServer('odataProxy');
  let odataUri = getConfigurationServer('odataUri');
  let odataMountPath = getConfigurationServer('odataMountPath');
  let resourcesProxy = getConfigurationServer('resourcesProxy');
  let serveFolder = getConfigurationServer('serveFolder');
  let protocol = getConfigurationServer('protocol');
  let index = 'index.html';

  let framework = resourcesProxy.indexOf('OpenUI5') >= 0 ? 'openui5' : 'sapui5';

  let debugSources = getConfigurationBuilder('debugSources');
  let uglifySources = getConfigurationBuilder('uglifySources');
  let portLiveReload = 35729;
  // @ts-ignore
  let lrPath = __non_webpack_require__.resolve('../scripts/livereload');

  let ui5ToolsPath = lrPath.slice(0, lrPath.indexOf('scripts'));
  let cert = {
    key: fs.readFileSync(path.join(ui5ToolsPath, 'cert', 'server.key')),
    cert: fs.readFileSync(path.join(ui5ToolsPath, 'cert', 'server.cert')),
  };

  let open = restarting ? false : openBrowser;

  let baseDir = getRoot();

  let files = [];
  let serveStatic = [];
  let routes = {};
  let folders = [];
  let foldersRoot = [];
  let foldersRootMap = {};
  let manifests = {};

  let foldersWithName = [];

  let servingFolder = serveFolder === 'Source Folder' ? srcFolder : distFolder;

  if (workspace.workspaceFolders) {
    // Is a workspace

    workspace.workspaceFolders.forEach((route) => {
      checkFolder(route.uri.fsPath, {
        servingFolder,
        foldersWithName,
        route,
        folders,
        files,
        watchExtensions,
        foldersRoot,
        foldersRootMap,
        serveStatic,
        routes,
        manifests,
      });
    });

    if (folders.length == 0) {
      fs.readdirSync(baseDir).forEach((fileOrFolder) => {
        checkFolder(path.join(baseDir, fileOrFolder), {
          servingFolder,
          foldersWithName,
          route: {
            name: fileOrFolder,
            uri: { path: fileOrFolder },
          },
          folders,
          files,
          watchExtensions,
          foldersRoot,
          foldersRootMap,
          serveStatic,
          routes,
          manifests,
        });
      });
    }
  } else {
    throw new Error('Create at least one project in your workspace');
  }

  let nConfig = {
    // General Config
    srcFolder,
    distFolder,
    ui5Version,
    ui5ToolsPath,
    // Server config
    cert,
    lrPath,
    serverName,
    port,
    openBrowser,
    watch,
    watchExtensions,
    odataProxy,
    odataUri,
    odataMountPath,
    resourcesProxy,
    serveFolder,
    index,
    protocol,
    // Builder config
    debugSources,
    uglifySources,
    // Modified config
    baseDir,
    foldersRoot,
    foldersRootMap,
    folders,
    foldersWithName,
    files,
    serveStatic,
    routes,
    open,
    portLiveReload,
    manifests,
    framework,
    // auth
    auth: {
      gatewayUser: config.auth ? config.auth.gatewayUser : '',
      gatewayPassword: config.auth ? config.auth.gatewayPassword : '',
      authGateway: config.auth ? config.auth.authGateway : undefined,
    },
  };
  config = nConfig;
  return nConfig;
}
function getConfig() {
  return config;
}

function checkFolder(
  folderPath,
  {
    servingFolder,
    foldersWithName,
    route,
    folders,
    files,
    watchExtensions,
    foldersRoot,
    foldersRootMap,
    serveStatic,
    routes,
    manifests,
  }
) {
  let folder, folderUri;
  if (fs.existsSync(path.join(folderPath, servingFolder))) {
    if (fs.existsSync(path.join(folderPath, servingFolder, 'manifest.json'))) {
      let rawManifest = fs.readFileSync(path.join(folderPath, servingFolder, 'manifest.json'), 'utf8');
      try {
        let manifestJson = JSON.parse(rawManifest);
        if (manifestJson['sap.app'] && manifestJson['sap.app'].id) {
          folder = '' + folderPath.split(path.sep).pop();
          foldersWithName.push(route);
          folders.push(folder);

          manifests[folder] = manifestJson;

          files.push(path.join(folder, servingFolder, `*.{${watchExtensions}}`));
          files.push(path.join(folder, servingFolder, '**', `*.{${watchExtensions}}`));

          folderUri = '/' + folder;
          routes[folderUri] = path.join(folder, servingFolder);

          foldersRoot.push(path.join(folderPath, servingFolder));
          foldersRootMap[folderUri] = path.join(folderPath, servingFolder);

          serveStatic.push({
            route: folder,
            dir: path.join(folderPath, servingFolder),
          });
        }
      } catch (err) {}
    }
  }
}

function getOptionsVersion(ui5toolsData = {}, config = getConfig()) {
  let { ui5Version } = config;

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
}

export default {
  getOptionsVersion,
  getConfigurationGeneral,
  getConfigurationServer,
  getConfigurationBuilder,
  getRoot,
  loadConfig,
  getConfig,
};
