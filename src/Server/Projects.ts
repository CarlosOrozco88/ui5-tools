import { ServerOptions } from '../Types/Types';
import Server from './Server';
import { ui5ProjectExcludeResources } from './Middlewares/Resources';
import { cacheBusterIndex, cacheBusterMiddleware } from './Middlewares/Cachebuster';
import { liveTranspileBabel } from './Middlewares/LiveTranspileBabel';
import Ui5Project from '../Project/Ui5Project';
import { createStaticMiddleware } from './Middlewares/Static';

export default {
  async serve(oConfigParams: ServerOptions): Promise<void> {
    const { ui5Projects = [] } = oConfigParams;
    // Static serve all apps
    for (const ui5Project of ui5Projects) {
      await this.serveProject(ui5Project, oConfigParams);
    }
  },

  async serveProject(ui5Project: Ui5Project, oConfigParams = Server.getServerOptions()) {
    const staticPath = ui5Project.getServedPath(oConfigParams?.bServeProduction);

    await ui5Project.generate();

    const ui5ProjectCacheBusterMiddleware = cacheBusterMiddleware();
    const ui5LiveTranspileMiddleware = liveTranspileBabel(ui5Project);
    const ui5StaticMiddleware = createStaticMiddleware(staticPath);
    oConfigParams?.serverApp?.use(
      ui5Project.serverPath,
      ui5ProjectExcludeResources,
      ui5ProjectCacheBusterMiddleware,
      ui5LiveTranspileMiddleware,
      ui5StaticMiddleware
    );
    const bCacheBuster = Server.isCachebusterOn();
    if (bCacheBuster) {
      const ui5ProjectCacheBusterIndex = cacheBusterIndex(ui5Project);
      oConfigParams?.serverApp?.get(`${ui5Project.serverPath}sap-ui-cachebuster-info.json`, ui5ProjectCacheBusterIndex);
    }
  },

  unserveProject(ui5Project: Ui5Project, oConfigParams = Server.getServerOptions()) {
    const routes: Array<any> = oConfigParams?.serverApp._router.stack ?? [];
    for (let i = routes.length - 1; i >= 0; i--) {
      const route = routes[i];
      const isThisRoute = route.regexp.test(ui5Project.serverPath);
      const isUi5ProjectMiddleware = route.name.startsWith('ui5Project');
      if (isThisRoute && isUi5ProjectMiddleware) {
        routes.splice(i, 1);
      }
    }
  },
};
