import { FileStat, RelativePattern, workspace } from 'vscode';
import { NextFunction, Request, Response } from 'express';
import Ui5Project from '../../Project/Ui5Project';
import Finder from '../../Project/Finder';
import Server from '../Server';

export function cacheBusterIndex(ui5Project: Ui5Project) {
  return async function ui5ProjectCacheBusterIndex(req: Request, res: Response) {
    const oCacheBuster: Record<string, string> = {
      tokenUi5RepositoryScope: String(new Date().getTime()),
    };
    const bServeProduction = Server.isStartedProduction();
    const fsServedPath = ui5Project.getServedPath(bServeProduction);
    const aUris = await workspace.findFiles(new RelativePattern(fsServedPath, `**/*`));
    const aTimes: Array<Thenable<FileStat>> = [];
    const aPaths = aUris.map((oUri) => {
      aTimes.push(workspace.fs.stat(oUri));
      return Finder.fsPathToServerPath(oUri.fsPath);
    });
    const aTimesRes = await Promise.all(aTimes);
    aTimesRes.forEach((oTime, i) => {
      const sPath = aPaths[i].replace(ui5Project.serverPath, '');
      oCacheBuster[sPath] = String(oTime.mtime || oTime.mtime);
    });
    res.set('Cache-control', 'no-cache');

    const sCacheBuster = JSON.stringify(oCacheBuster, null, 2);
    res.send(sCacheBuster);
  };
}

export function cacheBusterMiddleware() {
  return async function ui5ProjectCacheBusterMiddleware(req: Request, res: Response, next: NextFunction) {
    const bCacheBuster = Server.isCachebusterOn();
    if (bCacheBuster) {
      const oRegex = new RegExp('(/~).*(~)', 'g');
      if (oRegex.test(req.originalUrl)) {
        req.originalUrl = req.originalUrl.replace(oRegex, '');
        req.url = req.url.replace(oRegex, '');
        // Will save cache for local sources with same timestamp 8h
        res.set('Cache-control', 'public, max-age=28800');
      }
    }
    next();
  };
}
