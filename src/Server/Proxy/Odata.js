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
          let targets = targetUri.replace(/\\s/g).split(',');
          proxy = createProxyMiddleware({
            pathRewrite: {},
            target: targets[0],
            secure: targets[0].indexOf('https') == 0,
            changeOrigin: true,
            auth: this.getODATAAuth(),
            logLevel: 'error',
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
              proxy = createProxyMiddleware({
                pathRewrite: function (i, path, req) {
                  let nPath = path.replace(mpaths[i], '');
                  return nPath;
                }.bind(this, i),
                target: targets[i],
                secure: targets[i].indexOf('https') == 0,
                changeOrigin: true,
                auth: this.getODATAAuth(i),
                logLevel: 'error',
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
    Utils.loadEnv();
    let auth = undefined;

    let userKey = 'UI5TOOLS_ODATA_USER';
    let passKey = 'UI5TOOLS_ODATA_PASSWORD';
    if (index) {
      userKey += `_${index + 1}`;
      passKey += `_${index + 1}`;
    }
    if (process.env[userKey] && process.env[passKey]) {
      auth = `${process.env[userKey]}:${process.env[passKey]}`;
    }

    return auth;
  },
};
