import { createProxyMiddleware } from 'http-proxy-middleware';

import Config from '../../Utils/Config';
import Utils from '../../Utils/Utils';
import Log from '../../Utils/Log';
import { ServerOptions } from '../../Types/Types';
// import { URL, URLSearchParams } from 'url';
// import { ClientRequest, IncomingMessage } from 'http';

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
          // const baseUriParts = new URL(targets[0]);

          proxy = createProxyMiddleware({
            pathRewrite: {},
            target: targets[0],
            secure: !!Config.server('odataSecure'),
            // onProxyReq(proxyReq, req, res) {
            //   const gatewayQuery = '' + Config.server('gatewayQuery');
            //   if (gatewayQuery) {
            //     //@ts-ignore
            //     // const oOriginalCookies = req.cookies;
            //     // let sContextCookie = oOriginalCookies['sap-usercontext'];
            //     // const oContextCookie = new URLSearchParams(sContextCookie);

            //     const currentUrl = new URL(`${baseUriParts.origin}${proxyReq.path}?${gatewayQuery}`);
            //     const aQuery = gatewayQuery.split('&');
            //     aQuery.forEach((sQuery: string) => {
            //       const [key, value] = sQuery.split('=');
            //       currentUrl.searchParams.set(key, value);
            //       // if (oContextCookie.has(key)) {
            //       //   oContextCookie.set(key, value);
            //       // }
            //     });
            //     // sContextCookie = oContextCookie.toString();
            //     // const oNewCookies = {
            //     //   ...oOriginalCookies,
            //     //   'sap-usercontext': sContextCookie,
            //     // };

            //     // const oContextCookie = sContextCookie
            //     //   .split(';')
            //     //   .map((cookie: string) => cookie.split('='))
            //     //   .reduce((oObject: Record<string, any>, aKeyValue: Array<any>) => {
            //     //     const [key, value] = aKeyValue;
            //     //     oObject[decodeURIComponent(key.trim())] = decodeURIComponent(value.trim());
            //     //     return oObject;
            //     //   });
            //     // const oNewCookiesParams = Object.entries(oNewCookies)
            //     //   .map((aKeyValue) => aKeyValue.join('='))
            //     //   .join('; ');
            //     // const sNewCookies = decodeURI(oNewCookiesParams.toString());
            //     // proxyReq.setHeader('cookie', sNewCookies);
            //     // res.setHeader('cookie', sNewCookies);
            //     //@ts-ignore
            //     // res.cookie('sap-usercontext', sNewCookies);

            //     // console.log(sNewCookies);

            //     const path = currentUrl.toString().replace(baseUriParts.origin, '');

            //     proxyReq.path = path;
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
          // const querys = gatewayQuery.replace(/\\s/g, '').split(',');
          for (let i = 0; i < targets.length; i++) {
            if (mpaths && mpaths[i]) {
              Log.server(`Creating resourcesProxy to Other ${targets[i]}`);

              proxy = createProxyMiddleware({
                pathRewrite: function (i: number, path: string) {
                  const nPath = path.replace(mpaths[i], '');
                  return nPath;
                }.bind(this, i),
                target: targets[i],
                secure: !!Config.server('odataSecure'),
                // onProxyReq: function (query: string, proxyRex: ClientRequest, req: IncomingMessage) {
                //   let url = req.url;
                //   if (query) {
                //     url = `${proxyRex.path}?${gatewayQuery}`;
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
