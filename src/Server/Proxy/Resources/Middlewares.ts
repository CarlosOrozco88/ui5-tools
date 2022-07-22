import { RequestHandler } from 'http-proxy-middleware';
import onHeaders from 'on-headers';

export const noCache: RequestHandler = function (req, res, next): void {
  //@ts-ignore
  onHeaders(res, () => {
    res.setHeader('cache-control', 'no-cache');
  });
  next();
};

export const removeCacheBusterString: RequestHandler = function (req, res, next) {
  req.originalUrl = req.originalUrl.replace('sap-ui-cachebuster/', '/');
  req.url = req.url.replace('sap-ui-cachebuster/', '/');
  next();
};
