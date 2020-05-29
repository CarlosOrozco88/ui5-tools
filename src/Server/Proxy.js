import { window } from 'vscode';
import { createProxyMiddleware } from 'http-proxy-middleware';
import http from 'http';
import https from 'https';
import apicache from 'apicache';

const onlyStatus200 = (req, res) => res.statusCode === 200;
const cacheResources = apicache.middleware('1 day', onlyStatus200);

import StatusBar from '../StatusBar/StatusBar';
import Utils from '../Utils/Utils';

function resetCache() {
  if (apicache.clear) {
    apicache.clear(null);
  }
}

async function setODataProxy(expressApp, { auth }) {
  let proxy, targetUri;
  let odataProxy = Utils.getConfigurationServer('odataProxy');
  // Options: Gateway, None
  switch (odataProxy) {
    case 'Gateway':
      targetUri = Utils.getConfigurationServer('odataUri');

      proxy = createProxyMiddleware({
        pathRewrite: {},
        target: targetUri,
        secure: targetUri.indexOf('https') == 0,
        changeOrigin: true,
        //logLevel: 'debug',
      });
      expressApp.use('/sap', proxy);
      break;

    default:
      break;
  }
  return;
}

async function setResourcesProxy(expressApp, config) {
  let { ui5Version, framework } = config;
  let targetUri, proxy;
  let resourcesProxy = Utils.getConfigurationServer('resourcesProxy');

  // Options: Gateway, CDN SAPUI5, CDN OpenUI5, None
  switch (resourcesProxy) {
    case 'Gateway':
      targetUri = Utils.getConfigurationServer('odataUri');

      if (targetUri) {
        proxy = createProxyMiddleware({
          pathRewrite: function (path, req) {
            var nPath = path;
            if (path.indexOf('/resources/') === 0) {
              nPath = `/sap/public/bc/ui5_ui5/1${path}`;
            } else {
              nPath = `/sap/bc/ui5_ui5/sap${path}`;
            }
            return nPath;
          },
          target: targetUri,
          secure: targetUri.indexOf('https') == 0,
          changeOrigin: true,
          //logLevel: 'debug',
        });

        expressApp.use(['/resources', '/**/resources'], cacheResources, proxy);
      }
      break;

    case 'CDN SAPUI5':
    case 'CDN OpenUI5':
      targetUri = `https://${framework}.hana.ondemand.com/${ui5Version}/`;

      if (ui5Version) {
        proxy = createProxyMiddleware({
          pathRewrite: function (path, req) {
            var nPath = path;
            if (path.indexOf('/resources/') > 0) {
              nPath = path.slice(path.indexOf('/resources/'), path.length);
            }
            return nPath;
          },
          target: targetUri,
          secure: targetUri.indexOf('https') == 0,
          changeOrigin: true,
          logLevel: 'debug',
        });

        expressApp.use(['/resources', '/**/resources'], cacheResources, proxy);
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

function setTestResourcesProxy(expressApp, { ui5Version }) {
  let targetUri = `https://sapui5.hana.ondemand.com/${ui5Version}/`;

  if (ui5Version) {
    let proxy = createProxyMiddleware({
      pathRewrite: {
        '^/flp/': '/',
      },
      target: targetUri,
      secure: targetUri.indexOf('https') == 0,
      changeOrigin: true,
      //logLevel: 'debug',
    });

    expressApp.use('/flp/test-resources/**', cacheResources, proxy);
  }
}

export default {
  setODataProxy,
  setResourcesProxy,
  setTestResourcesProxy,
  resetCache,
};
