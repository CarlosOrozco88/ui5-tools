import liveReload from 'livereload';
import connectLiveReload from 'connect-livereload';
import fs from 'fs';
import url from 'url';
import http from 'http';
import https from 'https';
import path from 'path';

import Utils from '../Utils/Utils';
import Config from '../Utils/Config';

let appLiveServer;

function start(expressApp) {
  return new Promise(async function (resolv, reject) {
    try {
      let portLiveReload = 35729;
      if (!appLiveServer) {
        let requestHandler = (req, res) => {
          if (url.parse(req.url).pathname === '/livereload.js') {
            res.writeHead(200, {
              'Content-Type': 'text/javascript',
            });
            return res.end(fs.readFileSync(path.join(Utils.getUi5ToolsPath(), 'static', 'scripts', 'livereload.js')));
          }
        };

        let protocol = Config.server('protocol');
        let appLiveReload;
        if (protocol === 'http') {
          appLiveReload = http.createServer(requestHandler);
        } else {
          appLiveReload = https.createServer(Utils.getHttpsCert(), requestHandler);
        }

        let watchExtensions = Config.server('watchExtensions').replace(/\\s/g, '');

        let configLiveServer = {
          extraExts: 'xml,json,properties',
          exts: watchExtensions,
          port: portLiveReload,
          server: appLiveReload,
          debug: true,
          noListen: true,
        };

        appLiveServer = liveReload.createServer(configLiveServer);
      }
      let ui5Apps = await Utils.getAllUI5Apps();
      let foldersRoot = ui5Apps.map((ui5App) => {
        return ui5App.srcFsPath;
      });

      appLiveServer.watch(foldersRoot);
      appLiveServer.listen(() => {
        resolv();
      });

      expressApp.use(
        connectLiveReload({
          ignore: [],
          port: portLiveReload,
        })
      );
    } catch (error) {
      reject(error);
    }
  });
}

async function stop() {
  let stopped = false;
  if (appLiveServer) {
    appLiveServer.close();
    stopped = true;
  }
  return stopped;
}

export default {
  start,
  stop,
};
