const { workspace } = require('vscode');
const path = require('path');
const fs = require('fs');

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
    let arr = baseDir.split('/');
    arr.pop();
    baseDir = arr.join('/');
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
  let gatewayProxy = getConfigurationServer('gatewayProxy');
  let gatewayUri = getConfigurationServer('gatewayUri');
  let resourcesProxy = getConfigurationServer('resourcesProxy');
  let localDependencies = getConfigurationServer('localDependencies');
  let serveFolder = getConfigurationServer('serveFolder');
  let protocol = getConfigurationServer('protocol');
  let index = 'index.html';

  let debugSources = getConfigurationBuilder('debugSources');
  let uglifySources = getConfigurationBuilder('uglifySources');
  let portLiveReload = 35729;

  let open = restarting ? false : openBrowser;

  let baseDir = getRoot();

  let files = [];
  let serveStatic = [];
  let routes = {};
  let folders = [];
  let foldersRoot = [];
  let foldersRootMap = {};

  let foldersWithName = [];

  let servingFolder = serveFolder === 'Source Folder' ? srcFolder : distFolder;

  if (workspace.workspaceFolders) {
    // Is a workspace
    let folder, folderUri;
    workspace.workspaceFolders.forEach((route) => {
      folder = '' + route.uri.path.split(path.sep).pop();
      if (fs.existsSync(path.join(baseDir, folder, servingFolder))) {
        foldersWithName.push(route);
        folders.push(folder);

        files.push(path.join(folder, servingFolder, `*.{${watchExtensions}}`));
        files.push(path.join(folder, servingFolder, '**', `*.{${watchExtensions}}`));

        folderUri = '/' + folder;
        routes[folderUri] = path.join(folder, servingFolder);

        foldersRoot.push(path.join(baseDir, folder, servingFolder));
        foldersRootMap[folderUri] = path.join(baseDir, folder, servingFolder);

        serveStatic.push({
          route: folder,
          dir: path.join(route.uri.path, servingFolder),
        });
      }
    });
  } else {
    throw new Error('Create at least one project in your workspace');
  }

  return {
    // General Config
    srcFolder,
    distFolder,
    ui5Version,
    // Server config
    serverName,
    port,
    openBrowser,
    watch,
    watchExtensions,
    gatewayProxy,
    gatewayUri,
    resourcesProxy,
    localDependencies,
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
  };
}

function get404() {
  let errorPage = '<html><head><title>UI5 Server</title></head><body>';
  errorPage += '<p>ERROR 404</p>';
  errorPage += '</body></html>';

  return errorPage;
}

module.exports = {
  getConfigurationGeneral,
  getConfigurationServer,
  getConfigurationBuilder,
  getRoot,
  loadConfig,
  get404,
};
