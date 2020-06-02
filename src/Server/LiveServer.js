import liveReload from 'livereload';
import connectLiveReload from 'connect-livereload';
import fs from 'fs';
import url from 'url';
import http from 'http';
import https from 'https';
import path from 'path';

import Utils from '../Utils/Utils';
import Builder from '../Builder/Builder';

let appLiveServer;

function start(expressApp, { foldersRoot, portLiveReload, watchExtensions, protocol, cert, lrPath }) {
  return new Promise(function (resolv, reject) {
    try {
      if (!appLiveServer) {
        let requestHandler = function (req, res) {
          if (url.parse(req.url).pathname === '/livereload.js') {
            res.writeHead(200, {
              'Content-Type': 'text/javascript',
            });
            return res.end(fs.readFileSync(lrPath, 'utf-8'));
          }
        };

        let appLiveReload;
        if (protocol === 'http') {
          appLiveReload = http.createServer(requestHandler);
        } else {
          appLiveReload = https.createServer(cert, requestHandler);
        }

        let configLiveServer = {
          extraExts: 'xml,json,properties',
          exts: watchExtensions,
          port: portLiveReload,
          server: appLiveReload,
          noListen: true,
        };

        appLiveServer = liveReload.createServer(configLiveServer);
      }
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
    } catch (e) {
      reject(e);
    }
  });
}

async function stop() {
  if (appLiveServer) {
    appLiveServer.close();
  }
  return;
}

export default {
  start,
  stop,
};
