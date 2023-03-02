import { createProxyMiddleware } from 'http-proxy-middleware';
import { ServerOptions } from '../../../Types/Types';
import Config from '../../../Utils/ConfigVscode';
import Log from '../../../Utils/LogVscode';
import { createAuthMiddleware } from './Middlewares';

const Other = {
  set({ serverApp }: ServerOptions) {
    const odataMountPath = Config.server('odataMountPath') as string;
    const targetUri = Config.server('odataUri') as string;

    if (targetUri) {
      const targets = targetUri.replace(/\\s/g, '').split(',');
      const mpaths = odataMountPath.replace(/\\s/g, '').split(',');

      for (let i = 0; i < targets.length && i < mpaths.length; i++) {
        Log.server(`Creating resourcesProxy to Other ${targets[i]}`);

        const proxy = createProxyMiddleware({
          // pathRewrite: function (i: number, path: string) {
          //   const nPath = path.replace(mpaths[i], '');
          //   return nPath;
          // }.bind(this, i),
          target: targets[i],
          secure: !!Config.server('odataSecure'),
          changeOrigin: true,
          logLevel: 'error',
          logProvider: Log.newLogProviderProxy,
        });
        serverApp.use(createAuthMiddleware(i));
        serverApp.use(mpaths[i], proxy);
      }
    }
  },
};
export default Other;
