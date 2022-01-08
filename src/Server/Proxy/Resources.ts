import { Uri, window, workspace } from 'vscode';
import { createProxyMiddleware } from 'http-proxy-middleware';
import express from 'express';
import apicache from 'apicache';
import onHeaders from 'on-headers';

import Ui5Provider from '../../Configurator/Ui5Provider';
import Config from '../../Utils/Config';
import Utils from '../../Utils/Utils';
import Log from '../../Utils/Log';
import { Level, SandboxFile, ServerOptions } from '../../Types/Types';
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
    let ui5Version = String(Config.general('ui5Version'));

    // Options: Gateway, CDN SAPUI5, CDN OpenUI5, None
    switch (resourcesProxy) {
      case 'Gateway':
        targetUri = String(Config.server('resourcesUri'));
        try {
          await Ui5Provider.configureGWVersion(targetUri); // Upadate for correct version
          ui5Version = String(Config.general('ui5Version'));
        } catch (oError) {
          // if it is not possible to update, continue as normal
        }

        if (targetUri) {
          // const baseUriParts = new URL(targetUri);
          Log.server(`Creating resourcesProxy with ui5Version ${ui5Version} to Gateway ${targetUri}`);
          proxy = createProxyMiddleware({
            pathRewrite(path) {
              const basePath = '/sap/public/bc/ui5_ui5/1';
              const resourcesPath = path.slice(path.indexOf('/resources/'), path.length);
              return `${basePath}${resourcesPath}`;
            },
            // onProxyReq(proxyReq, req, res) {
            //   const gatewayQuery = '' + Config.server('gatewayQuery');
            //   if (gatewayQuery) {
            //     const currentUrl = new URL(`${baseUriParts.origin}${proxyReq.path}?${gatewayQuery}`);
            //     const aQuery = gatewayQuery.split('&');
            //     aQuery.forEach((sQuery: string) => {
            //       const [key, value] = sQuery.split('=');
            //       currentUrl.searchParams.set(key, value);
            //     });

            //     const path = currentUrl.toString().replace(baseUriParts.origin, '');

            //     proxyReq.path = path;
            //   }
            // },
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

      case 'Runtime': {
        Log.server(`Loading SAPUI5 ${ui5Version} Runtime`);

        const runtimeFsPath = Utils.getRuntimeFsPath(true);

        try {
          await workspace.fs.stat(Uri.file(runtimeFsPath));
        } catch (oError) {
          Log.server(`SAPUI5 ${ui5Version} Runtime not found. Starting download...`, Level.WARNING);
          // Version not downloaded
          const versions = await Ui5Provider.getRuntimeVersions();
          const major = versions.find((v) => ui5Version.indexOf(v.version) === 0);
          if (!major) {
            const sMessage = Log.server(`Selected SAPUI5 version ${ui5Version} is not available`, Level.ERROR);
            throw new Error(sMessage);
          }
          const minor = major.patches.find((v) => ui5Version === v.version);
          if (!minor) {
            const sMessage = Log.server(`Selected SAPUI5 version ${ui5Version} is not available`, Level.ERROR);
            throw new Error(sMessage);
          }
          await Ui5Provider.downloadRuntime(minor);
        }

        serverApp.use(
          ['/resources', '/**/resources'],
          (req, res, next) => {
            req.originalUrl = req.originalUrl.replace('sap-ui-cachebuster/', '/');
            req.url = req.url.replace('sap-ui-cachebuster/', '/');
            next();
          },
          onProxyRes,
          cacheResources,
          express.static(runtimeFsPath, {
            maxAge: '0',
          })
        );
        break;
      }

      default:
        break;
    }
    return;
  },

  async setTest({ serverApp }: ServerOptions): Promise<void> {
    const resourcesProxy = Config.server('resourcesProxy');

    const sandboxFsPath = Utils.getSandboxFsPath();
    const sandboxUri = Uri.file(sandboxFsPath);
    const sandboxFile = await workspace.fs.readFile(sandboxUri);
    const sandboxData: SandboxFile = JSON.parse(sandboxFile.toString());

    switch (resourcesProxy) {
      case 'Gateway':
      case 'CDN SAPUI5':
      case 'Runtime':
        serverApp.get('/flp/test-resources/sap/ushell/bootstrap/sandbox.js', async (req, res) => {
          const ui5Version = '' + Config.general('ui5Version');
          const hash = sandboxData.versions[ui5Version] || sandboxData.versions[sandboxData.default];
          const file = sandboxData.files[hash];
          res.send(file);
        });
        break;
      default:
        break;
    }
  },
};
