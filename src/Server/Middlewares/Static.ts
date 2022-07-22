import { NextFunction, Request, Response } from 'express';
import express from 'express';

export function createStaticMiddleware(staticPath: string) {
  return function ui5ProjectStatic(req: Request, res: Response, next: NextFunction) {
    express.static(staticPath, {
      maxAge: '0',
    })(req, res, next);
  };
}
