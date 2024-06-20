import { createProxyMiddleware } from 'http-proxy-middleware';
import { ServerOptions } from '../../../Types/Types';
import Config from '../../../Utils/ConfigVscode';
import Log from '../../../Utils/LogVscode';
import { getODATAAuth } from './Middlewares';

const Other = {
  set({ serverApp }: ServerOptions) {
    const odataMountPath = Config.server('odataMountPath') as string;
    const targetUri = Config.server('odataUri') as string;

    if (targetUri) {
      const targets = targetUri.replace(/\\s/g, '').split(',');
      const mpaths = odataMountPath.replace(/\\s/g, '').split(',');

      for (let i = 0; i < targets.length && i < mpaths.length; i++) {
        Log.server(`Creating odataProxy to Other ${targets[i]}`);

        const proxy = createProxyMiddleware({
          pathRewrite: (path: string) => {
            const nPath = path.replace(mpaths[i], '');
            return nPath;
          },
          target: targets[i],
          changeOrigin: true,
          autoRewrite: true,
          xfwd: true,
          logger: Log.newLogProviderProxy(),
          pathFilter: `${mpaths[i]}/**`,
          auth: getODATAAuth() ?? undefined,
          secure: !!Config.server('odataSecure'),
        });
        serverApp.use(proxy);
      }
    }
  },
};
export default Other;
