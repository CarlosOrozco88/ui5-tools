import { NextFunction, Request, Response } from 'express';
import path from 'path';
import { Uri } from 'vscode';

import Babel from '../../Project/BuildSteps/Babel';
import { Level } from '../../Types/Types';
import Log from '../../Utils/LogVscode';
import Ui5Project from '../../Project/Ui5Project';
import Config from '../../Utils/ConfigVscode';
import Server from '../Server';
import Extension from '../../Utils/ExtensionVscode';

export function liveTranspileBabel(ui5Project: Ui5Project) {
  return async function ui5ProjectLiveTranspileBabel(req: Request, res: Response, next: NextFunction) {
    const bBabelSourcesLive = !!Config.server('babelSourcesLive');
    if (!bBabelSourcesLive) {
      next();
      return;
    }
    const babelSourcesExclude = Config.builder('babelSourcesExclude') as string;
    const aBabelExclude = babelSourcesExclude?.split(',') ?? [];

    const sInnerPath = req.originalUrl;

    let bTranspile =
      (sInnerPath.endsWith('.js') || sInnerPath.endsWith('.ts')) &&
      (!sInnerPath.endsWith('-preload.js') || !sInnerPath.endsWith('-preload.ts'));

    bTranspile = bTranspile && !Extension.excluder(sInnerPath, aBabelExclude);

    if (!bTranspile) {
      next();
      return;
    }
    try {
      const bServeProduction = Server.isStartedProduction();
      const fsServedPath = ui5Project.getServedPath(bServeProduction);
      const fsPathJs = path.join(fsServedPath, req.path);

      const uriJs = Uri.file(fsPathJs);

      const babelified = await Babel.transpileUriLive(uriJs);
      const response = babelified?.code ?? '';
      Log.server(`LiveTranspile: ${fsPathJs} transpiled successfully`, Level.INFO);
      res.send(response);
    } catch (error: any) {
      // Does not exist js file
      Log.server(`LiveTranspile: ${error.message}`, Level.ERROR);
      next();
    }
  };
}
