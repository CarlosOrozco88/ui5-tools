import path from 'path';

import Log from '../../Utils/LogVscode';
import ResourcesProxy from '../Proxy/Resources';
import { ServerOptions } from '../../Types/Types';
import { Request, Response } from 'express';
import Finder from '../../Project/Finder';
import Ui5 from '../../Utils/Ui5Vscode';

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
        const aTiles = [] as Array<Record<string, any>>;
        const aActions = {} as Record<string, any>;
        const ui5Projects = await Finder.getAllUI5Projects();
        ui5Projects.forEach((ui5Project) => {
          const hash = ui5Project.folderName.toLowerCase();
          //@ts-ignore
          aTiles.push({
            id: hash,
            title: ui5Project.folderName,
            size: '1x1',
            tileType: 'sap.ushell.ui.tile.StaticTile',
            properties: {
              chipId: 'catalogTile_15',
              title: ui5Project.folderName,
              info: ui5Project.namespace,
              icon: '',
              targetURL: `#ui5tools-${hash}`,
            },
          });
          aActions[hash] = {
            semanticObject: 'ui5tools',
            action: hash,
            title: ui5Project.folderName,
            signature: {
              parameters: {},
              additionalParameters: 'allowed',
            },
            resolutionResult: {
              additionalInformation: `SAPUI5.Component=${ui5Project.namespace}`,
              applicationType: 'SAPUI5',
              url: `..${ui5Project.serverPath}`,
            },
          };
        });
        const fioriSandboxConfig = {
          services: {
            LaunchPage: {
              adapter: {
                config: {
                  catalogs: [
                    {
                      id: 'projects_catalog',
                      title: 'Projects Catalog',
                      tiles: aTiles,
                    },
                  ],
                  groups: [
                    {
                      id: 'ui5_tools_group',
                      title: 'Ui5 Tools Projects',
                      isPreset: true,
                      isVisible: true,
                      isGroupLocked: false,
                      tiles: aTiles,
                    },
                  ],
                },
              },
            },
            NavTargetResolution: {
              config: {
                enableClientSideTargetResolution: true,
              },
            },
            ClientSideTargetResolution: {
              adapter: {
                config: {
                  inbounds: aActions,
                },
              },
            },
          },
        };
        res.send(JSON.stringify(fioriSandboxConfig, null, 2));
      });
      serverApp.get('/appconfig/fioriSandboxConfig.json', (req, res) => {
        res.sendFile(path.join(baseDir, 'fioriSandboxConfig.json'));
      });

      await ResourcesProxy.setTest(oConfigParams);
    }
  },
};
