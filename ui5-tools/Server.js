const express = require('express');
const { workspace } = require('vscode');
const StatusBar = require('./StatusBar');
const Utils = require('./Utils');
const Proxy = require('./Proxy');

let app, server;

function start(restarting = false) {
  return new Promise((resolv, reject) => {
    if (checkWorkspace()) {
      StatusBar.startingText();

      let config = Utils.loadConfig(restarting);
      let { foldersRootMap, port, watch, baseDir, open } = config;

      app = express();

      app.use('/', express.static(baseDir));

      if (watch) {
        require('./LiveServer').watch(app, config);
      }

      Object.entries(foldersRootMap).forEach(([key, folderRoot]) => {
        app.use(key, express.static(folderRoot));
      });

      Proxy.setProxys(app)
        .then(() => {
          server = app.listen(port, () => {
            StatusBar.stopText();
            if (open && !restarting) {
              require('opn')(`http://localhost:${port}/`);
            }
            resolv();
          });
        })
        .catch(() => {
          reject();
        });
    } else {
      reject();
    }
  });
}

function stop() {
  StatusBar.stoppingText();
  return new Promise((resolv) => {
    server.close(() => {
      app = undefined;
      server = undefined;
      StatusBar.startText();
      resolv();
    });
  });
}

function get() {
  return server;
}

async function restart() {
  await stop();
  await start(true);
}

async function toggle() {
  if (!server || !server.listening) {
    await start();
  } else {
    await stop();
  }
  return;
}

function checkWorkspace() {
  if (!workspace.workspaceFolders) {
    this.showError(`Open a folder or workspace... (File -> Open Folder)`, true);
    return false;
  }
  if (!workspace.workspaceFolders.length) {
    this.showError(`You've not added any folder in the workspace`, true);
    return false;
  }
  return true;
}

module.exports = {
  start,
  stop,
  restart,
  toggle,
  get,
};
