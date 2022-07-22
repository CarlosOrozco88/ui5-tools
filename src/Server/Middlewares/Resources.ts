import { NextFunction, Request, Response } from 'express';

export function ui5ProjectExcludeResources(req: Request, res: Response, next: NextFunction) {
  const sInnerPath = req.url;
  if (sInnerPath.indexOf('/resources') < 0) {
    next();
  } else {
    res.status(404).end('404');
  }
}
