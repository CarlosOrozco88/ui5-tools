import { createProxyMiddleware } from 'http-proxy-middleware';
import Ui5Provider from '../../../Configurator/Ui5Provider';
import Config from '../../../Utils/ConfigVscode';
import Log from '../../../Utils/LogVscode';
import { noCache } from './Middlewares';
import { ServerOptions } from '../../../Types/Types';

const Gateway = {
  async set({ serverApp }: ServerOptions) {
    const targetUri = Config.server('resourcesUri') as string;

    if (targetUri) {
      try {
        await Ui5Provider.configureGWVersion(targetUri);
      } catch (oError) {
        // if it is not possible to update, continue as normal
      }
      const ui5Version = Config.general('ui5Version') as string;

      Log.server(`Creating resourcesProxy with ui5Version ${ui5Version} to Gateway ${targetUri}`);

      serverApp.use(
        ['/resources', '/**/resources'],
        noCache,
        createProxyMiddleware({
          pathRewrite(path) {
            const basePath = '/sap/public/bc/ui5_ui5/1';
            const resourcesPath = path.slice(path.indexOf('/resources/'), path.length);
            return `${basePath}${resourcesPath}`;
          },
          target: targetUri,
          secure: !!Config.server('resourcesSecure'),
          changeOrigin: true,
          logLevel: 'error',
          logProvider: Log.newLogProviderProxy,
        })
      );
    }
  },
};
export default Gateway;
