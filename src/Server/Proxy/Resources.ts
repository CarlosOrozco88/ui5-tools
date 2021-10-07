import { window } from 'vscode';
import { createProxyMiddleware } from 'http-proxy-middleware';

import apicache from 'apicache';
import onHeaders from 'on-headers';

import Ui5Provider from '../../Configurator/Ui5Provider';
import Config from '../../Utils/Config';
import Utils from '../../Utils/Utils';
import Log from '../../Utils/Log';
import { Level, ServerOptions } from '../../Types/Types';
import { RequestHandler } from 'express';

const cacheResources = apicache
  .options({
    defaultDuration: '1 day',
    statusCodes: {
      include: [200],
    },
    headers: {
      'cache-control': 'no-cache',
    },
    //@ts-ignore
    respectCacheControl: false,
  })
  .middleware();

const onProxyRes: RequestHandler = function (req, res, next): void {
  //@ts-ignore
  onHeaders(res, () => {
    res.setHeader('cache-control', 'no-cache');
  });
  next();
};

export default {
  resetCache(): void {
    if (apicache.clear) {
      Log.server(`Clear resources cache`);
      apicache.clear('');
    }
  },

  async set({ serverApp }: ServerOptions): Promise<void> {
    const framework = Utils.getFramework();
    let targetUri, proxy;
    const resourcesProxy = String(Config.server('resourcesProxy'));
    let ui5Version = Config.general('ui5Version');

    // Options: Gateway, CDN SAPUI5, CDN OpenUI5, None
    switch (resourcesProxy) {
      case 'Gateway':
        targetUri = String(Config.server('resourcesUri'));
        try {
          await Ui5Provider.configureGWVersion(targetUri); // Upadate for correct version
          ui5Version = Config.general('ui5Version');
        } catch (oError) {
          // if it is not possible to update, continue as normal
        }

        if (targetUri) {
          Log.server(`Creating resourcesProxy with ui5Version ${ui5Version} to Gateway ${targetUri}`);
          proxy = createProxyMiddleware({
            pathRewrite(path) {
              const basePath = '/sap/public/bc/ui5_ui5/1';
              const resourcesPath = path.slice(path.indexOf('/resources/'), path.length);
              return `${basePath}${resourcesPath}`;
            },
            target: targetUri,
            secure: Boolean(Config.server('resourcesSecure')),
            changeOrigin: true,
            logLevel: 'error',
            logProvider: Log.newLogProviderProxy,
          });

          serverApp.use(['/resources', '/**/resources'], onProxyRes, cacheResources, proxy);
        }
        break;

      case 'CDN SAPUI5':
      case 'CDN OpenUI5':
        targetUri = `https://${framework}.hana.ondemand.com/${ui5Version}/`;

        if (ui5Version) {
          Log.server(`Creating resourcesProxy with ui5Version ${ui5Version} to CDN ${targetUri}`);
          proxy = createProxyMiddleware({
            pathRewrite(path, req) {
              const resourcesPath = path.slice(path.indexOf('/resources/'), path.length);
              return resourcesPath;
            },
            target: targetUri,
            secure: Boolean(Config.server('resourcesSecure')),
            changeOrigin: true,
            logLevel: 'error',
            logProvider: Log.newLogProviderProxy,
          });

          serverApp.use(['/resources', '/**/resources'], onProxyRes, cacheResources, proxy);
        }

        try {
          // Check for sap-ui-core.JS
          const url = `${targetUri}resources/sap-ui-core.js`;
          Utils.fetchFile(url);
        } catch (oError) {
          const sError = `Error: Unable to get sap-ui-core.js, framework ${framework} does not have ${ui5Version} available at CDN.`;

          Log.server(sError, Level.ERROR);
          window.showErrorMessage(sError);
        }
        break;

      default:
        break;
    }
    return;
  },

  setTest({ serverApp }: ServerOptions): void {
    const ui5Version = Config.general('ui5Version');
    const resourcesProxy = Config.server('resourcesProxy');
    const framework = Utils.getFramework();
    let targetUri = ``;

    let basePath = '';
    switch (resourcesProxy) {
      case 'Gateway':
        targetUri = String(Config.server('resourcesUri'));
        basePath = '/sap/public/bc/ui5_ui5/1';
        serverApp.get('/flp/test-resources/sap/ushell/bootstrap/sandbox.js', async (req, res) => {
          const sCdnTargetUri = `https://sapui5.hana.ondemand.com/${ui5Version}/`;
          const url = `${sCdnTargetUri}test-resources/sap/ushell/bootstrap/sandbox.js`;
          const fileBuffer = await Utils.fetchFile(url);
          res.send(fileBuffer.toString());
        });
        break;
      case 'CDN SAPUI5':
        targetUri = `https://${framework}.hana.ondemand.com/${ui5Version}/`;
        break;
      default:
        break;
    }
    if (targetUri) {
      Log.server(`Creating testProxy with ui5Version ${ui5Version} to ${targetUri}`);
      const proxy = createProxyMiddleware({
        pathRewrite(path, req) {
          const resourcesPath = path.slice(path.indexOf('/test-resources/'), path.length);
          return `${basePath}${resourcesPath}`;
        },
        target: targetUri,
        secure: Boolean(Config.server('resourcesSecure')),
        changeOrigin: true,
        logLevel: 'error',
        logProvider: Log.newLogProviderProxy,
      });

      serverApp.use('/flp/test-resources/**', onProxyRes, cacheResources, proxy);
    }
  },
};
