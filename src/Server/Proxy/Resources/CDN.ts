import { createProxyMiddleware } from 'http-proxy-middleware';
import { window } from 'vscode';
import { Level, ServerOptions } from '../../../Types/Types';
import Config from '../../../Utils/ConfigVscode';
import Fetch from '../../../Utils/Fetch';
import Log from '../../../Utils/LogVscode';
import Utils from '../../../Utils/ExtensionVscode';

const CDN = {
  set({ serverApp }: ServerOptions) {
    const framework = Utils.getFramework();
    const ui5Version = Config.general('ui5Version') as string;
    const targetUri = `https://${framework}.hana.ondemand.com/${ui5Version}/`;

    if (ui5Version) {
      Log.server(`Creating resourcesProxy with ui5Version ${ui5Version} to CDN ${targetUri}`);

      serverApp.use(
        createProxyMiddleware({
          pathRewrite(path) {
            const resourcesPath = path.slice(path.indexOf('/resources/'), path.length);
            return resourcesPath;
          },
          headers: {
            'cache-control': 'no-cache',
          },
          changeOrigin: true,
          autoRewrite: true,
          xfwd: true,
          logger: Log.newLogProviderProxy(),
          pathFilter: ['/resources/**', '/**/resources/**'],
          target: targetUri,
          secure: !!Config.server('resourcesSecure'),
        })
      );
    }

    try {
      // Check for sap-ui-core.JS
      const url = `${targetUri}resources/sap-ui-core.js`;
      Fetch.file(url);
    } catch (oError) {
      const sError = `Error: Unable to get sap-ui-core.js, framework ${framework} does not have ${ui5Version} available at CDN.`;

      Log.server(sError, Level.ERROR);
      window.showErrorMessage(sError);
    }
  },
};
export default CDN;
