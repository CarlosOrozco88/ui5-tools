// @ts-ignore
import expressTimeout from 'express-timeout-handler';
import { Level, ServerOptions } from '../../Types/Types';
import Log from '../../Utils/LogVscode';

export function timeoutMiddleware(oConfigParams: ServerOptions) {
  return expressTimeout.handler({
    timeout: oConfigParams.timeout,
    onTimeout(req: any, res: any) {
      const message = Log.server('UI5 Tools server timeout', Level.ERROR);
      res.status(503).send(message);
    },
    onDelayedResponse() {
      Log.server('Attempted to call ${method} after timeout', Level.ERROR);
    },
  });
}
