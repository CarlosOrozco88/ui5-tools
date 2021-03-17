import { window } from 'vscode';
import { createProxyMiddleware } from 'http-proxy-middleware';
import https from 'https';
import apicache from 'apicache';
import Config from '../../Utils/Config';
import Utils from '../../Utils/Utils';
import onHeaders from 'on-headers';

const cacheResources = apicache
  .options({
    defaultDuration: '1 day',
    statusCodes: {
      exclude: [404, 403],
    },
    headers: {
      'cache-control': 'no-cache',
    },
    //respectCacheControl: true,
  })
  .middleware();

const onProxyRes = function (req, res, next) {
  onHeaders(res, () => {
    res.set('cache-control', 'no-cache');
  });
  next();
};

export default {
  resetCache() {
    if (apicache.clear) {
      Utils.logOutputServer(`Clear resources cache`);
      apicache.clear(null);
    }
  },

  async set(serverApp) {
    let framework = Utils.getFramework();
    let targetUri, proxy;
    let resourcesProxy = Config.server('resourcesProxy');
    let ui5Version = Config.general('ui5Version');

    // Options: Gateway, CDN SAPUI5, CDN OpenUI5, None
    switch (resourcesProxy) {
      case 'Gateway':
        targetUri = Config.server('resourcesUri');

        if (targetUri) {
          Utils.logOutputServer(`Creating resourcesProxy with ui5Version ${ui5Version} to Gateway ${targetUri}`);
          proxy = createProxyMiddleware({
            pathRewrite(path, req) {
              let basePath = '/sap/public/bc/ui5_ui5/1';
              let resourcesPath = path.slice(path.indexOf('/resources/'), path.length);
              return `${basePath}${resourcesPath}`;
            },
            target: targetUri,
            secure: Config.server('resourcesSecure'),
            changeOrigin: true,
            logLevel: 'error',
            logProvider: Utils.newLogProviderProxy,
          });

          serverApp.use(['/resources', '/**/resources'], onProxyRes, cacheResources, proxy);
        }
        break;

      case 'CDN SAPUI5':
      case 'CDN OpenUI5':
        targetUri = `https://${framework}.hana.ondemand.com/${ui5Version}/`;

        if (ui5Version) {
          Utils.logOutputServer(`Creating resourcesProxy with ui5Version ${ui5Version} to CDN ${targetUri}`);
          proxy = createProxyMiddleware({
            pathRewrite(path, req) {
              let resourcesPath = path.slice(path.indexOf('/resources/'), path.length);
              return resourcesPath;
            },
            target: targetUri,
            secure: Config.server('resourcesSecure'),
            changeOrigin: true,
            logLevel: 'error',
            logProvider: Utils.newLogProviderProxy,
          });

          serverApp.use(['/resources', '/**/resources'], onProxyRes, cacheResources, proxy);
        }

        let testUrl = `${targetUri}resources/sap-ui-core.js`;
        let options = {
          timeout: 5000,
        };
        https
          .get(testUrl, options, ({ statusCode }) => {
            if (statusCode !== 200) {
              let sError = `Error: Unable to get sap-ui-core.js, framework ${framework} does not have ${ui5Version} available at CDN.`;

              Utils.logOutputServer(sError, 'ERROR');
              window.showErrorMessage(sError);
            }
          })
          .on('error', (oError) => {
            window.showErrorMessage(oError.message);
            Utils.logOutputServer(oError.message, 'ERROR');
          });

      default:
        break;
    }
    return;
  },

  setTest(serverApp) {
    let ui5Version = Config.general('ui5Version');
    let resourcesProxy = Config.server('resourcesProxy');
    let framework = Utils.getFramework();
    let targetUri = ``;

    switch (resourcesProxy) {
      case 'Gateway':
        targetUri = Config.server('resourcesUri');

        break;
      case 'CDN SAPUI5':
        targetUri = `https://${framework}.hana.ondemand.com/${ui5Version}/`;
        break;
      default:
        break;
    }
    if (targetUri) {
      Utils.logOutputServer(`Creating testProxy with ui5Version ${ui5Version} to ${targetUri}`);
      let proxy = createProxyMiddleware({
        pathRewrite: {
          '^/flp/': '/',
        },
        target: targetUri,
        secure: Config.server('resourcesSecure'),
        changeOrigin: true,
        logLevel: 'error',
        logProvider: Utils.newLogProviderProxy,
      });

      serverApp.use('/flp/test-resources/**', onProxyRes, cacheResources, proxy);
    }
  },
};
