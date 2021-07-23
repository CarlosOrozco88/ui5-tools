import path from 'path';

import Utils from '../../Utils/Utils';
import ResourcesProxy from '../../Server/Proxy/Resources';

export default {
  async set(oConfigParams) {
    let { serverApp, ui5Apps = [], baseDir, ui5ToolsPath, isLaunchpadMounted } = oConfigParams;
    if (isLaunchpadMounted) {
      Utils.logOutputServer('Mounting launchpad');
      // LAUNCHPAD IN /flp/

      // DONT MOUNT RESOURCE ROOTS TO SIMULATE LAUNCHPAD
      // Object.entries(manifests).forEach(([folder, manifest]) => {
      //   fioriSandboxConfig.modulePaths[manifest['sap.app'].id] = `../${folder}`;
      // });

      let ui5toolsData = Utils.getOptionsVersion();
      let flpPath = path.join(ui5ToolsPath, 'static', 'index', 'flp');

      let indexFLP = (req, res, next) => {
        res.render(path.join(flpPath, 'index'), { theme: ui5toolsData.theme });
      };
      serverApp.get('/flp/', indexFLP);
      serverApp.get('/flp/index.html', indexFLP);

      let fioriSandboxConfig = {
        modulePaths: {},
        applications: {},
      };
      ui5Apps.forEach((ui5App) => {
        let hash = 'ui5tools-' + ui5App.folderName.toLowerCase();
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
    return;
  },
};
