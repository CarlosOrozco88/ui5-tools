import { window } from 'vscode';
import { createProxyMiddleware } from 'http-proxy-middleware';

import apicache from 'apicache';
import Ui5Provider from '../../Configurator/Ui5Provider';
import Config from '../../Utils/Config';
import Utils from '../../Utils/Utils';

const cacheResources = apicache
  .options({
    defaultDuration: '1 day',
    statusCodes: {
      exclude: [404, 403],
    },
  })
  .middleware();

export default {
  resetCache() {
    if (apicache.clear) {
      Utils.logOutputServer(`Clear resources cache`);
      apicache.clear(null);
    }
  },

  async set({ serverApp }) {
    let framework = Utils.getFramework();
    let targetUri, proxy;
    let resourcesProxy = Config.server('resourcesProxy');
    let ui5Version = Config.general('ui5Version');

    // Options: Gateway, CDN SAPUI5, CDN OpenUI5, None
    switch (resourcesProxy) {
      case 'Gateway':
        targetUri = Config.server('resourcesUri');
        try {
          await Ui5Provider.configureGWVersion(targetUri); // Upadate for correct version
          ui5Version = Config.general('ui5Version');
        } catch (oError) {
          // if it is not possible to update, continue as normal
        }

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

          serverApp.use(['/resources', '/**/resources'], cacheResources, proxy);
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

          serverApp.use(['/resources', '/**/resources'], cacheResources, proxy);
        }

        try {
          // Check for sap-ui-core.JS
          let url = `${targetUri}resources/sap-ui-core.js`;
          Utils.fetchFile(url);
        } catch (oError) {
          let sError = `Error: Unable to get sap-ui-core.js, framework ${framework} does not have ${ui5Version} available at CDN.`;

          Utils.logOutputServer(sError, 'ERROR');
          window.showErrorMessage(sError);
        }

      default:
        break;
    }
    return;
  },

  setTest({ serverApp }) {
    let ui5Version = Config.general('ui5Version');
    let resourcesProxy = Config.server('resourcesProxy');
    let framework = Utils.getFramework();
    let targetUri = ``;

    let basePath = '';
    switch (resourcesProxy) {
      case 'Gateway':
        targetUri = Config.server('resourcesUri');
        basePath = '/sap/public/bc/ui5_ui5/1';
        serverApp.get('/flp/test-resources/sap/ushell/bootstrap/sandbox.js', async (req, res) => {
          let sCdnTargetUri = `https://sapui5.hana.ondemand.com/${ui5Version}/`;
          let url = `${sCdnTargetUri}test-resources/sap/ushell/bootstrap/sandbox.js`;
          let sFile = await Utils.fetchFile(url);
          res.send(sFile);
        });
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
        pathRewrite(path, req) {
          let resourcesPath = path.slice(path.indexOf('/test-resources/'), path.length);
          return `${basePath}${resourcesPath}`;
        },
        target: targetUri,
        secure: Config.server('resourcesSecure'),
        changeOrigin: true,
        logLevel: 'error',
        logProvider: Utils.newLogProviderProxy,
      });

      serverApp.use('/flp/test-resources/**', cacheResources, proxy);
    }
  },
};
