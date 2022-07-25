import { NextFunction, Request, Response } from 'express';
import path from 'path';
import { Uri } from 'vscode';
import minimatch from 'minimatch';

import Babel from '../../Project/BuildSteps/Babel';
import { Level } from '../../Types/Types';
import Log from '../../Utils/LogVscode';
import Ui5Project from '../../Project/Ui5Project';
import Typescript from '../../Project/BuildSteps/Typescript';
import Config from '../../Utils/ConfigVscode';
import Server from '../Server';

export function liveTranspileBabel(ui5Project: Ui5Project) {
  return async function ui5ProjectLiveTranspileBabel(req: Request, res: Response, next: NextFunction) {
    const bBabelSourcesLive = !!Config.server('babelSourcesLive');
    if (!bBabelSourcesLive) {
      next();
      return;
    }
    const babelSourcesExclude = Config.builder('babelSourcesExclude') as string;
    const aBabelExclude = babelSourcesExclude?.split(',') ?? [];

    const sInnerPath = req.url;

    let bTranspile = sInnerPath.endsWith('.js') && !sInnerPath.endsWith('-preload.js');
    for (let i = 0; bTranspile && i < aBabelExclude.length; i++) {
      const sExclude = aBabelExclude[i];
      bTranspile = !minimatch(sInnerPath, sExclude);
    }

    if (!bTranspile) {
      next();
      return;
    }
    try {
      const bServeProduction = Server.isStartedProduction();
      const fsServedPath = ui5Project.getServedPath(bServeProduction);
      const fsPathJs = path.join(fsServedPath, req.path);

      const uriJs = Uri.file(fsPathJs);

      let response = '';
      if (ui5Project.isGenerated()) {
        const pathGeneratedTs = fsPathJs.replace('.js', '.ts');
        try {
          const pathWorkingTs = pathGeneratedTs.replace(ui5Project.fsPathGenerated, ui5Project.fsPathWorking);
          const uriWorkingTs = Uri.file(pathWorkingTs);
          const babelified = await Typescript.transpileUriLive(uriWorkingTs, {
            filename: path.basename(pathGeneratedTs),
            sourceFileName: path.basename(pathGeneratedTs),
          });
          response = babelified?.code ?? '';
        } catch (error: any) {
          // Does not exist ts file
          console.error(error.message);
        }
      }
      if (!response) {
        try {
          const babelified = await Babel.transpileUriLive(uriJs);
          response = babelified?.code ?? '';
        } catch (error: any) {
          // Does not exist js file
          console.error(error.message);
        }
      }
      if (response) {
        Log.server(`LiveTranspile: ${fsPathJs} transpiled successfully`, Level.INFO);
        res.send(response);
        return;
      }
    } catch (error: any) {
      Log.server(`LiveTranspile: ${error.message}`, Level.WARNING);
    }
    next();
  };
}
