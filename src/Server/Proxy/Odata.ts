import { createProxyMiddleware } from 'http-proxy-middleware';

import Config from '../../Utils/Config';
import Utils from '../../Utils/Utils';
import Log from '../../Utils/Log';
import { ServerOptions } from '../../Types/Types';
// import { URL } from 'url';
// import { ClientRequest, IncomingMessage } from 'http';

export default {
  async set({ serverApp }: ServerOptions): Promise<void> {
    const odataMountPath = String(Config.server('odataMountPath'));
    let proxy, targetUri;
    const odataProxy = Config.server('odataProxy');
    // const odataQuery = '' + Config.server('odataQuery');
    // Options: Gateway, None
    switch (odataProxy) {
      case 'Gateway':
        targetUri = String(Config.server('odataUri'));

        if (targetUri) {
          Log.server(`Creating odataProxy to Gateway ${targetUri}`);
          const targets = targetUri.replace(/\\s/g, '').split(',');
          const oAuth = this.getODATAAuth();
          // const baseUriParts = new URL(targets[0]);

          proxy = createProxyMiddleware({
            pathRewrite: {},
            // pathRewrite: (path, req) => {
            //   let newPath = path;

            //   const newQuery = { ...req.query };
            //   const currentUrl = new URL(`${baseUriParts.origin}${path}`);
            //   const aQuery = odataQuery.split('&');
            //   aQuery.forEach((query) => {
            //     const keyValue = query.split('=');
            //     if (keyValue.length === 2) {
            //       currentUrl.searchParams.set(keyValue[0], keyValue[1]);
            //     }
            //   });
            //   const aQuery = odataQuery.split('&');
            //   aQuery.forEach((query) => {
            //     const keyValue = query.split('=');
            //     if (keyValue.length === 2) {
            //       const key = keyValue[0];
            //       const value = keyValue[1];
            //       newQuery[key] = value;
            //     }
            //   });

            //   if (Object.keys(newQuery).length) {
            //     // There were more query parameters than just _csrf
            //     newPath = `${newPath.split('?')[0]}?${newQuery.stringify(newQuery)}`;
            //   } else {
            //     // _csrf was the only query parameter
            //     newPath = `${newPath.split('?')[0]}`;
            //   }

            //   return newPath;
            // },
            target: targets[0],
            secure: Boolean(Config.server('odataSecure')),
            // onProxyReq(proxyRex, req) {
            //   console.log(baseUriParts);
            //   if (odataQuery) {
            //     const currentUrl = new URL(`${baseUriParts.origin}${proxyRex.path}?${odataQuery}`);
            //     const aQuery = odataQuery.split('&');
            //     aQuery.forEach((query) => {
            //       const keyValue = query.split('=');
            //       if (keyValue.length === 2) {
            //         currentUrl.searchParams.set(keyValue[0], keyValue[1]);
            //       }
            //     });
            //     const path = currentUrl.toString().replace(baseUriParts.origin, '');
            //     Log.proxy(path);
            //     proxyRex.path = path;
            //   }
            // },
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
          // const querys = odataQuery.replace(/\\s/g, '').split(',');
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
                // onProxyReq: function (query: string, proxyRex: ClientRequest, req: IncomingMessage) {
                //   let url = req.url;
                //   if (query) {
                //     url = `${proxyRex.path}?${odataQuery}`;
                //   }
                //   return url;
                // }.bind(this, querys[i]),
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
