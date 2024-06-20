import { RequestHandler } from 'express';

export const removeCacheBusterString: RequestHandler = function (req, res, next) {
  req.originalUrl = req.originalUrl.replace('sap-ui-cachebuster/', '/');
  req.url = req.url.replace('sap-ui-cachebuster/', '/');
  next();
};
