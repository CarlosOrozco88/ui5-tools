import path from 'path';

import Utils from '../../Utils/Utils';
import Log from '../../Utils/Log';
import ResourcesProxy from '../Proxy/Resources';
import { ServerOptions } from '../../Types/Types';
import { NextFunction, Request, Response } from 'express';

export default {
  async set(oConfigParams: ServerOptions): Promise<void> {
    const { serverApp, ui5Apps = [], baseDir, ui5ToolsPath, isLaunchpadMounted } = oConfigParams;
    if (isLaunchpadMounted) {
      Log.logServer('Mounting launchpad');
      // LAUNCHPAD IN /flp/

      // DONT MOUNT RESOURCE ROOTS TO SIMULATE LAUNCHPAD
      // Object.entries(manifests).forEach(([folder, manifest]) => {
      //   fioriSandboxConfig.modulePaths[manifest['sap.app'].id] = `../${folder}`;
      // });

      const ui5toolsData = Utils.getOptionsVersion();
      const flpPath = path.join(ui5ToolsPath, 'static', 'index', 'flp');

      const indexFLP = (req: Request, res: Response, next: NextFunction) => {
        res.render(path.join(flpPath, 'index'), { theme: ui5toolsData.theme });
      };
      serverApp.get('/flp/', indexFLP);
      serverApp.get('/flp/index.html', indexFLP);

      const fioriSandboxConfig = {
        modulePaths: {},
        applications: {},
      };
      ui5Apps.forEach((ui5App) => {
        const hash = 'ui5tools-' + ui5App.folderName.toLowerCase();
        //@ts-ignore
        fioriSandboxConfig.applications[hash] = {
          additionalInformation: `SAPUI5.Component=${ui5App.namespace}`,
          applicationType: 'SAPUI5',
          url: ui5App.appServerPath,
          description: ui5App.namespace,
          title: ui5App.folderName,
        };
      });

      serverApp.get('/flp/test-resources/sap/ushell/shells/sandbox/fioriSandboxConfig.json', (req, res) => {
        res.send(JSON.stringify(fioriSandboxConfig, null, 2));
      });
      serverApp.get('/appconfig/fioriSandboxConfig.json', (req, res) => {
        res.sendFile(path.join(baseDir, 'fioriSandboxConfig.json'));
      });

      ResourcesProxy.setTest(oConfigParams);
    }
  },
};
