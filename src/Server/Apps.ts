import express, { response } from 'express';
import Utils from '../Utils/Utils';
import { workspace, RelativePattern, FileStat, Uri } from 'vscode';
import minimatch from 'minimatch';
import { Level, ServerOptions, Ui5App, Ui5Apps } from '../Types/Types';
import Builder from '../Builder/Builder';
import Log from '../Utils/Log';
import path from 'path';
import Server from './Server';

export default {
  /**
   * Starts server in development mode (serving srcFolder)
   * @param {object} object params
   */
  async serve(oConfigParams: ServerOptions): Promise<void> {
    const { ui5Apps = [] } = oConfigParams;
    // Static serve all apps
    ui5Apps.forEach((ui5App) => this.serveApp(ui5App, oConfigParams));
  },

  serveApp(ui5App: Ui5App, oConfigParams: ServerOptions = Server.getServerOptions()) {
    const {
      serverApp,
      bServeProduction = false,
      bCacheBuster,
      bBabelSourcesLive,
      sBabelSourcesExclude,
    } = oConfigParams;
    const staticPath = bServeProduction ? ui5App.distFsPath : ui5App.srcFsPath;

    const aBabelExclude = sBabelSourcesExclude ? sBabelSourcesExclude.split(',') : [];
    serverApp.use(
      ui5App.appServerPath,
      async (req, res, next) => {
        const bExists = await Utils.findUi5AppForFsPath(ui5App.appFsPath);
        if (bExists) {
          next();
        } else {
          res.send('DELETED ');
        }
      },
      async (req, res, next) => {
        const sInnerPath = req.url;
        if (bCacheBuster) {
          if (sInnerPath.indexOf('/resources') < 0 && sInnerPath.indexOf('/sap/public/') < 0) {
            // Not loading ui5 resources or public resources from gateway like themes
            const oRegex = new RegExp('(/~).*(~)', 'g');
            if (oRegex.test(req.originalUrl)) {
              req.originalUrl = req.originalUrl.replace(oRegex, '');
              req.url = req.url.replace(oRegex, '');
              // Will save cache for local sources with same timestamp 8h
              res.set('Cache-control', 'public, max-age=28800');
            }
          }
        }
        let bTranspile = false;
        if (bBabelSourcesLive) {
          if (sInnerPath.endsWith('.js') && !sInnerPath.includes('resources/') && !sInnerPath.endsWith('-preload.js')) {
            try {
              bTranspile = true;
              for (let i = 0; i < aBabelExclude.length && bTranspile; i++) {
                const sExclude = aBabelExclude[i];
                bTranspile = !minimatch(sInnerPath, sExclude);
              }
              if (bTranspile) {
                const fsPath = Uri.file(path.join(staticPath, req.path));
                const babelifiedCode = await Builder.babelifyFile(ui5App, fsPath);
                res.type('.js');
                // Log.server(
                //   `LiveTranspile: ${path.join(req.baseUrl, req.baseUrl)} transpiled successfully`,
                //   Level.INFO
                // );

                res.set('Cache-Control', 'no-store');
                res.send(babelifiedCode);
              } else {
                // Log.server(`LiveTranspile: ${req.path} skipped babelify`, Level.INFO);
              }
            } catch (error: any) {
              Log.server(`LiveTranspile: ${error.message}`, Level.WARNING);
              bTranspile = false;
            }
          }
        }
        if (!bTranspile) {
          next();
        }
      },
      express.static(staticPath, {
        maxAge: '0',
      })
    );

    // CacheBuster
    if (bCacheBuster) {
      serverApp.get(`${ui5App.appServerPath}sap-ui-cachebuster-info.json`, async (req, res) => {
        const oCacheBuster: Record<string, string> = {
          tokenUi5RepositoryScope: String(new Date().getTime()),
        };
        const aUris = await workspace.findFiles(new RelativePattern(staticPath, `**/*`));
        const aTimes: Array<Thenable<FileStat>> = [];
        const aPaths = aUris.map((oUri) => {
          aTimes.push(workspace.fs.stat(oUri));
          return Utils.fsPathToServerPath(oUri.fsPath);
        });
        const aTimesRes = await Promise.all(aTimes);
        aTimesRes.forEach((oTime, i) => {
          const sPath = aPaths[i].replace(ui5App.appServerPath, '');
          oCacheBuster[sPath] = String(oTime.mtime || oTime.mtime);
        });
        res.set('Cache-control', 'no-cache');

        res.send(JSON.stringify(oCacheBuster, null, 2));
      });
    }
  },
};
