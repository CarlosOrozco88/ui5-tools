import path from 'path';

import Utils from '../../Utils/Extension';
import Log from '../../Utils/Log';
import ResourcesProxy from '../Proxy/Resources';
import { ServerOptions } from '../../Types/Types';
import { Request, Response } from 'express';
import Finder from '../../Project/Finder';
import Ui5 from '../../Utils/Ui5';

export default {
  async set(oConfigParams: ServerOptions): Promise<void> {
    const { serverApp, baseDir, ui5ToolsPath, isLaunchpadMounted } = oConfigParams;
    if (isLaunchpadMounted) {
      Log.server('Mounting launchpad');
      // LAUNCHPAD IN /flp/

      // DONT MOUNT RESOURCE ROOTS TO SIMULATE LAUNCHPAD
      // Object.entries(manifests).forEach(([folder, manifest]) => {
      //   fioriSandboxConfig.modulePaths[manifest['sap.app'].id] = `../${folder}`;
      // });

      const ui5toolsData = Ui5.getOptionsVersion();
      const flpPath = path.join(ui5ToolsPath, 'static', 'index', 'flp');

      const indexFLP = (req: Request, res: Response) => {
        res.render(path.join(flpPath, 'index'), { theme: ui5toolsData.theme });
      };
      serverApp.get('/flp/', indexFLP);
      serverApp.get('/flp/index.html', indexFLP);

      serverApp.get('/flp/test-resources/sap/ushell/shells/sandbox/fioriSandboxConfig.json', async (req, res) => {
        const fioriSandboxConfig = {
          modulePaths: {},
          applications: {},
        };
        const ui5Projects = await Finder.getAllUI5Projects();
        ui5Projects.forEach((ui5Project) => {
          const hash = 'ui5tools-' + ui5Project.folderName.toLowerCase();
          //@ts-ignore
          fioriSandboxConfig.applications[hash] = {
            additionalInformation: `SAPUI5.Component=${ui5Project.namespace}`,
            applicationType: 'SAPUI5',
            url: ui5Project.serverPath,
            description: ui5Project.namespace,
            title: ui5Project.folderName,
          };
        });
        res.send(JSON.stringify(fioriSandboxConfig, null, 2));
      });
      serverApp.get('/appconfig/fioriSandboxConfig.json', (req, res) => {
        res.sendFile(path.join(baseDir, 'fioriSandboxConfig.json'));
      });

      await ResourcesProxy.setTest(oConfigParams);
    }
  },
};
