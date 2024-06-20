import { createProxyMiddleware } from 'http-proxy-middleware';
import { ServerOptions } from '../../../Types/Types';
import Config from '../../../Utils/ConfigVscode';
import Log from '../../../Utils/LogVscode';
import { getODATAAuth } from './Middlewares';

const Gateway = {
  set({ serverApp }: ServerOptions) {
    const targetUri = Config.server('odataUri') as string;

    if (targetUri) {
      Log.server(`Creating odataProxy to Gateway ${targetUri}`);

      const targets = targetUri.replace(/\\s/g, '').split(',');

      const proxy = createProxyMiddleware({
        pathRewrite: {},
        target: targets[0],
        secure: !!Config.server('odataSecure'),
        changeOrigin: true,
        autoRewrite: true,
        xfwd: true,
        logger: Log.newLogProviderProxy(),
        auth: getODATAAuth() ?? undefined,
        pathFilter: ['/sap/opu/odata/**', '/sap/public/bc/themes/**', '/sap/bc/**'],
      });
      serverApp.use(proxy);
    }
  },
};
export default Gateway;
