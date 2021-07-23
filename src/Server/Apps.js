import express from 'express';
import Utils from '../Utils/Utils';
import { workspace, RelativePattern } from 'vscode';

export default {
  /**
   * Starts server in development mode (serving srcFolder)
   * @param {object} object params
   */
  async serve({ serverApp, ui5Apps = [], bServeProduction = false }) {
    // Static serve all apps
    ui5Apps.forEach((ui5App) => {
      let staticPath = bServeProduction ? ui5App.distFsPath : ui5App.srcFsPath;

      serverApp.use(
        ui5App.appServerPath,
        (req, res, next) => {
          let sInnerPath = req.url;
          if (sInnerPath.indexOf('/resources') < 0 && sInnerPath.indexOf('/sap/public/') < 0) {
            // Not loading ui5 resources or public resources from gateway like themes
            let oRegex = new RegExp('(/~).*(~)', 'g');
            if (oRegex.test(req.originalUrl)) {
              req.originalUrl = req.originalUrl.replace(oRegex, '');
              req.url = req.url.replace(oRegex, '');
              // Will save cache for local sources with same timestamp 8h
              res.set('Cache-control', 'public, max-age=28800');
            }
          }

          next();
        },
        express.static(staticPath)
      );

      // CacheBuster
      serverApp.get(`${ui5App.appServerPath}sap-ui-cachebuster-info.json`, async (req, res) => {
        let oCacheBuster = {
          tokenUi5RepositoryScope: String(new Date().getTime()),
        };
        let aUris = await workspace.findFiles(new RelativePattern(staticPath, `**/*`));
        let aTimes = [];
        let aPaths = aUris.map((oUri) => {
          aTimes.push(workspace.fs.stat(oUri));
          return Utils.fsPathToServerPath(oUri.fsPath);
        });
        let aTimesRes = await Promise.all(aTimes);
        aTimesRes.forEach((oTime, i) => {
          let sPath = aPaths[i].replace(ui5App.appServerPath, '');
          oCacheBuster[sPath] = String(oTime.mtime || oTime.mtime);
        });
        res.set('Cache-control', 'no-cache');

        res.send(JSON.stringify(oCacheBuster, null, 2));
      });
    });
  },
};
