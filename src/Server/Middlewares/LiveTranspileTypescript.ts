import { NextFunction, Request, Response } from 'express';
import path from 'path';
import { Uri, workspace } from 'vscode';

import Typescript from '../../Project/BuildSteps/Typescript';
import { Level } from '../../Types/Types';
import Log from '../../Utils/LogVscode';
import Ui5Project from '../../Project/Ui5Project';
import Server from '../Server';

export function liveTranspileTypescript(ui5Project: Ui5Project) {
  const TranspileTypescriptCache: Map<string, { mtime: number; code: string }> = new Map();

  return async function ui5ProjectLiveTranspileTypescript(req: Request, res: Response, next: NextFunction) {
    const sInnerPath = req.originalUrl;

    const bServeProduction = Server.isStartedProduction();
    const bTranspile = sInnerPath.endsWith('.js') && !sInnerPath.endsWith('-preload.js');

    if (bServeProduction || !bTranspile) {
      next();
      return;
    }
    try {
      const fsServedPath = ui5Project.getServedPath();
      const fsPathJs = path.join(fsServedPath, req.path);
      const fsPathTs = fsPathJs.replace(/\.js$/, '.ts');

      let cachedResource = TranspileTypescriptCache.get(fsPathTs);
      if (!cachedResource) {
        cachedResource = { mtime: 0, code: '' };
        TranspileTypescriptCache.set(fsPathTs, cachedResource);
      }

      const uriTs = Uri.file(fsPathTs);
      const stat = await workspace.fs.stat(uriTs);

      let response = cachedResource.code;
      if (stat.mtime > cachedResource.mtime) {
        const babelified = await Typescript.transpileUri(uriTs);
        response = babelified?.code ?? '';
        TranspileTypescriptCache.set(fsPathTs, { mtime: stat.mtime, code: response });
        Log.server(`LiveTranspileTypescript: ${fsPathTs} transpiled successfully`, Level.INFO);
      }

      res.send(response);
    } catch (error: any) {
      // Does not exist js file
      Log.server(`LiveTranspileTypescript: ${error.message}`, Level.ERROR);
      next();
    }
  };
}
