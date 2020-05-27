import { window } from 'vscode';
import { createProxyMiddleware } from 'http-proxy-middleware';
import https from 'https';
import mcache from 'memory-cache';

import StatusBar from '../StatusBar/StatusBar';
import Utils from '../Utils/Utils';

async function setGatewayProxy(expressApp) {
  let proxy, targetUri;
  let gatewayProxy = Utils.getConfigurationServer('gatewayProxy');
  // Options: Gateway, None
  switch (gatewayProxy) {
    case 'Gateway':
      targetUri = Utils.getConfigurationServer('gatewayUri');
      proxy = createProxyMiddleware({
        pathRewrite: {},
        target: targetUri,
        secure: targetUri.indexOf('https') == 0,
        changeOrigin: true,
        logLevel: 'debug',
      });
      expressApp.use('/sap', proxy);
      break;

    default:
      break;
  }
  return;
}

async function setResourcesProxy(expressApp, folders = []) {
  let targetUri, pathRewrite, pathRoute, proxy;
  let resourcesProxy = Utils.getConfigurationServer('resourcesProxy');

  // Options: Gateway, CDN SAPUI5, CDN OpenUI5, None
  switch (resourcesProxy) {
    case 'Gateway':
      targetUri = Utils.getConfigurationServer('gatewayUri');

      if (targetUri) {
        pathRoute = '/sap/bc/ui5_ui5/sap';

        pathRewrite = {
          '^/': `${pathRoute}/`,
        };

        proxy = createProxyMiddleware({
          pathRewrite,
          target: targetUri,
          secure: targetUri.indexOf('https') == 0,
          changeOrigin: true,
          logLevel: 'debug',
        });

        expressApp.use('/**/resources/**', cacheProxyResources, proxy);
        expressApp.use('/resources/**', cacheProxyResources, proxy);
      }
      break;

    case 'CDN SAPUI5':
    case 'CDN OpenUI5':
      let framework = resourcesProxy.indexOf('SAPUI5') >= 0 ? 'sapui5' : 'openui5';
      let ui5Version = Utils.getConfigurationGeneral('ui5Version');

      targetUri = `https://${framework}.hana.ondemand.com/${ui5Version}/`;

      if (ui5Version) {
        pathRoute = '/';

        pathRewrite = {};
        folders.forEach((folder) => {
          pathRewrite[`^/${folder}/`] = pathRoute;
        });

        proxy = createProxyMiddleware({
          pathRewrite,
          target: targetUri,
          secure: targetUri.indexOf('https') == 0,
          changeOrigin: true,
          logLevel: 'debug',
        });

        expressApp.use('/**/resources/**', cacheProxyResources, proxy);
        expressApp.use('/resources/**', cacheProxyResources, proxy);
      }

      https
        .get(
          `${targetUri}resources/sap-ui-core.js`,
          {
            timeout: 1000 * 5, // 3 seconds to check if ui5 is available
          },
          ({ statusCode }) => {
            if (statusCode !== 200) {
              let error = `Error: Unable to get sap-ui-core.js, framework ${framework} does not have ${ui5Version} available at CDN.`;
              StatusBar.pushError(error);
              window.showErrorMessage(error);
            }
          }
        )
        .on('error', (e) => {
          let error = `Error: Unable to get sap-ui-core.js, framework ${framework} does not have ${ui5Version} available at CDN.`;
          StatusBar.pushError(error);
          window.showErrorMessage(error);
        });

    default:
      break;
  }
  return;
}

function cacheProxyResources(req, res, next) {
  if (req.method !== 'GET') return next();

  return next();

  let key = '__proxy_cache__' + req.originalUrl || req.url;

  let cachedBody = mcache.get(key);
  if (cachedBody) {
    res.send(cachedBody);
  } else {
    res.sendResponse = res.send;
    res.send = (body) => {
      mcache.put(key, body);
      res.sendResponse(body);
    };
    next();
  }
}

export default {
  setGatewayProxy,
  setResourcesProxy,
};
