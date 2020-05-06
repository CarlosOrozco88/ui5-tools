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
  let ui5Version = getConfigurationServer('ui5Version');
  let serverName = getConfigurationServer('name');
  let port = getConfigurationServer('port');
  let openBrowser = getConfigurationServer('openBrowser');
  let watch = getConfigurationServer('watch');
  let watchExtensions = getConfigurationServer('watchExtensions');
  let gatewayProxy = getConfigurationServer('gatewayProxy');
  let gatewayUri = getConfigurationServer('gatewayUri');
  let resourcesProxy = getConfigurationServer('resourcesProxy');
  let localDependencies = getConfigurationServer('localDependencies');
  let portLiveReload = 35729;

  let open = restarting ? false : openBrowser;

  let baseDir = getRoot();

  let files = [];
  let serveStatic = [];
  let routes = {};
  let folders = [];
  let foldersRoot = [];
  let foldersRootMap = {};

  let folder, folderUri;
  workspace.workspaceFolders.forEach((route) => {
    folder = '' + route.uri.path.split(path.sep).pop();
    if (fs.existsSync(path.join(baseDir, folder, srcFolder))) {
      folders.push(folder);

      files.push(path.join(folder, srcFolder, `*.{${watchExtensions}}`));
      files.push(path.join(folder, srcFolder, '**', `*.{${watchExtensions}}`));

      folderUri = '/' + folder;
      routes[folderUri] = path.join(folder, srcFolder);

      foldersRoot.push(path.join(baseDir, folder, srcFolder));
      foldersRootMap[folderUri] = path.join(baseDir, folder, srcFolder);

      serveStatic.push({
        route: folder,
        dir: path.join(route.uri.path, srcFolder),
      });
    }
  });

  return {
    // General Config
    srcFolder,
    // Server config
    ui5Version,
    serverName,
    port,
    openBrowser,
    watch,
    watchExtensions,
    gatewayProxy,
    gatewayUri,
    resourcesProxy,
    localDependencies,
    // Modified config
    baseDir,
    foldersRoot,
    foldersRootMap,
    folders,
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
  getRoot,
  loadConfig,
  get404,
};
