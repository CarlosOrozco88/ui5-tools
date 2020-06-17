import { window } from 'vscode';
import { createProxyMiddleware } from 'http-proxy-middleware';
import https from 'https';
import apicache from 'apicache';
import Config from '../../Utils/Config';
import Utils from '../../Utils/Utils';

const onlyStatus200 = (req, res) => res.statusCode === 200;
const cacheResources = apicache.middleware('1 day', onlyStatus200);

export default {
  resetCache() {
    if (apicache.clear) {
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
          proxy = createProxyMiddleware({
            pathRewrite(path, req) {
              let basePath = '/sap/public/bc/ui5_ui5/1';
              let resourcesPath = path.slice(path.indexOf('/resources/'), path.length);
              return `${basePath}${resourcesPath}`;
            },
            target: targetUri,
            secure: false, //targetUri.indexOf('https') == 0,
            changeOrigin: true,
            logLevel: 'error',
          });

          serverApp.use(['/resources', '/**/resources'], cacheResources, proxy);
        }
        break;

      case 'CDN SAPUI5':
      case 'CDN OpenUI5':
        targetUri = `https://${framework}.hana.ondemand.com/${ui5Version}/`;

        if (ui5Version) {
          proxy = createProxyMiddleware({
            pathRewrite(path, req) {
              let resourcesPath = path.slice(path.indexOf('/resources/'), path.length);
              return resourcesPath;
            },
            target: targetUri,
            secure: false, //targetUri.indexOf('https') == 0,
            changeOrigin: true,
            logLevel: 'error',
          });

          serverApp.use(['/resources', '/**/resources'], cacheResources, proxy);
        }

        let testUrl = `${targetUri}resources/sap-ui-core.js`;
        let options = {
          timeout: 5000,
        };
        https
          .get(testUrl, options, ({ statusCode }) => {
            if (statusCode !== 200) {
              let error = `Error: Unable to get sap-ui-core.js, framework ${framework} does not have ${ui5Version} available at CDN.`;

              window.showErrorMessage(error);
            }
          })
          .on('error', (error) => {
            window.showErrorMessage(error.message);
          });

      default:
        break;
    }
    return;
  },

  setTest(serverApp) {
    let ui5Version = Config.general('ui5Version');
    let targetUri = `https://sapui5.hana.ondemand.com/${ui5Version}/`;

    if (ui5Version) {
      let proxy = createProxyMiddleware({
        pathRewrite: {
          '^/flp/': '/',
        },
        target: targetUri,
        secure: false, //targetUri.indexOf('https') == 0,
        changeOrigin: true,
        logLevel: 'error',
      });

      serverApp.use('/flp/test-resources/**', cacheResources, proxy);
    }
  },
};
