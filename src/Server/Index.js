import express from 'express';
import path from 'path';
import fs from 'fs';

async function setIndexMiddleware(expressApp, config) {
  setServerIndexMiddleware(expressApp, config);
  setLaunchpadMiddleware(expressApp, config);
}

function setServerIndexMiddleware(expressApp, config) {
  let { ui5ToolsPath, folders, serverName, baseDir, manifests } = config;
  // SERVER INDEX
  expressApp.use('/', express.static(path.join(ui5ToolsPath, 'index', 'ui5', 'webapp')));
  expressApp.get('/ui5tools.json', function (req, res) {
    let readme = '';
    if (fs.existsSync(path.join(baseDir, 'README.md'))) {
      readme = fs.readFileSync(path.join(baseDir, 'README.md'), 'utf8');
    }
    res.json({
      readme: readme,
      folders: folders,
      manifests: manifests,
      serverName: serverName,
      launchpad: isLaunchpadMounted(config),
    });
  });
}

function isLaunchpadMounted({ resourcesProxy }) {
  return resourcesProxy === 'CDN SAPUI5' || resourcesProxy === 'Gateway';
}

function setLaunchpadMiddleware(expressApp, config) {
  if (isLaunchpadMounted(config)) {
    // LAUNCHPAD IN /flp/
    let { ui5ToolsPath, baseDir, manifests } = config;
    let fioriSandboxConfig = {
      modulePaths: {},
      applications: {},
    };
    Object.entries(manifests).forEach(([folder, manifest]) => {
      let hash = folder.split('_').join('-').toLowerCase();
      fioriSandboxConfig.applications[hash] = {
        additionalInformation: `SAPUI5.Component=${manifest['sap.app'].id}`,
        applicationType: 'SAPUI5',
        url: `../${folder}/`,
        description: manifest['sap.app'].id,
        title: folder,
      };
    });
    // DONT MOUNT RESOURCE ROOTS TO SIMULATE LAUNCHPAD
    // Object.entries(manifests).forEach(([folder, manifest]) => {
    //   fioriSandboxConfig.modulePaths[manifest['sap.app'].id] = `../${folder}`;
    // });
    expressApp.use('/flp/', express.static(path.join(ui5ToolsPath, 'index', 'flp', 'webapp')));
    expressApp.get('/flp/test-resources/sap/ushell/shells/sandbox/fioriSandboxConfig.json', function (req, res) {
      res.json(fioriSandboxConfig);
    });
    expressApp.get('/appconfig/fioriSandboxConfig.json', function (req, res) {
      res.sendFile(path.join(baseDir, 'fioriSandboxConfig.json'));
    });
  }
}

export default {
  setIndexMiddleware,
};
