import { createProxyMiddleware } from 'http-proxy-middleware';

import Config from '../../Utils/Config';
import Utils from '../../Utils/Utils';
import Log from '../../Utils/Log';
import { ServerOptions } from '../../Types/Types';

export default {
  async set({ serverApp }: ServerOptions): Promise<void> {
    const odataMountPath = String(Config.server('odataMountPath'));
    let proxy, targetUri;
    const odataProxy = Config.server('odataProxy');
    // Options: Gateway, None
    switch (odataProxy) {
      case 'Gateway':
        targetUri = String(Config.server('odataUri'));

        if (targetUri) {
          Log.server(`Creating odataProxy to Gateway ${targetUri}`);
          const targets = targetUri.replace(/\\s/g, '').split(',');
          const oAuth = this.getODATAAuth();

          proxy = createProxyMiddleware({
            pathRewrite: {},
            target: targets[0],
            secure: Boolean(Config.server('odataSecure')),
            changeOrigin: true,
            auth: oAuth,
            logLevel: 'error',
            logProvider: Log.newLogProviderProxy,
          });
          serverApp.use('/sap', proxy);
        }
        break;
      case 'Other':
        targetUri = String(Config.server('odataUri'));

        if (targetUri) {
          const targets = targetUri.replace(/\\s/g, '').split(',');
          const mpaths = odataMountPath.replace(/\\s/g, '').split(',');
          for (let i = 0; i < targets.length; i++) {
            if (mpaths && mpaths[i]) {
              Log.server(`Creating resourcesProxy to Other ${targets[i]}`);

              proxy = createProxyMiddleware({
                pathRewrite: function (i: number, path: string) {
                  const nPath = path.replace(mpaths[i], '');
                  return nPath;
                }.bind(this, i),
                target: targets[i],
                secure: Boolean(Config.server('odataSecure')),
                changeOrigin: true,
                auth: this.getODATAAuth(i),
                logLevel: 'error',
                logProvider: Log.newLogProviderProxy,
              });
              serverApp.use(mpaths[i], proxy);
            }
          }
        }

        break;

      default:
        break;
    }
    return;
  },

  getODATAAuth(index?: number): string {
    const oEnv = Utils.loadEnv();
    let auth = '';

    let userKey = 'UI5TOOLS_ODATA_USER';
    let passKey = 'UI5TOOLS_ODATA_PASSWORD';
    if (index) {
      userKey += `_${index + 1}`;
      passKey += `_${index + 1}`;
    }
    if (oEnv[userKey] && oEnv[passKey]) {
      auth = `${oEnv[userKey]}:${oEnv[passKey]}`;
    }

    return auth;
  },
};
