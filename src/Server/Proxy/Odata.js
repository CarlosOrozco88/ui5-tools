import { createProxyMiddleware } from 'http-proxy-middleware';

import Config from '../../Utils/Config';
import Utils from '../../Utils/Utils';

export default {
  async set(serverApp) {
    let odataMountPath = Config.server('odataMountPath');
    let proxy, targetUri;
    let odataProxy = Config.server('odataProxy');
    // Options: Gateway, None
    switch (odataProxy) {
      case 'Gateway':
        targetUri = Config.server('odataUri');

        if (targetUri) {
          Utils.logOutputServer(`Creating odataProxy to Gateway ${targetUri}`);
          let targets = targetUri.replace(/\\s/g).split(',');
          let oAuth = this.getODATAAuth();
          proxy = createProxyMiddleware({
            pathRewrite: {},
            target: targets[0],
            secure: Config.server('odataSecure'),
            changeOrigin: true,
            auth: oAuth,
            logLevel: 'error',
            logProvider: Utils.newLogProviderProxy,
          });
          serverApp.use('/sap', proxy);
        }
        break;
      case 'Other':
        targetUri = Config.server('odataUri');

        if (targetUri) {
          let targets = targetUri.replace(/\\s/g).split(',');
          let mpaths = odataMountPath.replace(/\\s/g).split(',');
          for (let i = 0; i < targets.length; i++) {
            if (mpaths && mpaths[i]) {
              Utils.logOutputServer(`Creating resourcesProxy to Other ${targets[i]}`);
              proxy = createProxyMiddleware({
                pathRewrite: function (i, path, req) {
                  let nPath = path.replace(mpaths[i], '');
                  return nPath;
                }.bind(this, i),
                target: targets[i],
                secure: Config.server('odataSecure'),
                changeOrigin: true,
                auth: this.getODATAAuth(i),
                logLevel: 'error',
                logProvider: Utils.newLogProviderProxy,
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

  getODATAAuth(index) {
    const oEnv = Utils.loadEnv();
    let auth = undefined;

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
