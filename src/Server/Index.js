import express from 'express';
import path from 'path';
import fs from 'fs';
import showdown from 'showdown';

const converter = new showdown.Converter();

async function setIndexMiddleware(expressApp, config) {
  setServerIndexMiddleware(expressApp, config);
  setLaunchpadMiddleware(expressApp, config);
}

function getOptionsVersion(ui5toolsData = {}, { ui5Version }) {
  let ui5VersionArray = ui5Version.split('.');
  if (ui5VersionArray.length >= 2) {
    if (ui5VersionArray[1] >= 42) {
      ui5toolsData.showTree = true;
    }

    if (ui5VersionArray[1] >= 65) {
      ui5toolsData.theme = 'sap_fiori_3';
    } else if (ui5VersionArray[1] >= 44) {
      ui5toolsData.theme = 'sap_belize';
    }
  }
  return ui5toolsData;
}
function setServerIndexMiddleware(expressApp, config) {
  let { ui5ToolsPath, folders, serverName, baseDir, manifests, ui5Version } = config;
  let ui5toolsData = {
    readme: '',
    folders: folders,
    manifests: manifests,
    serverName: serverName,
    launchpad: isLaunchpadMounted(config),
    docs: [],
    showTree: false,
    theme: 'sap_bluecrystal',
  };
  getOptionsVersion(ui5toolsData, config);
  // SERVER INDEX
  let indexHTML = function (req, res, next) {
    res.render(path.join(ui5ToolsPath, 'index', 'ui5', 'webapp', 'index'), { theme: ui5toolsData.theme });
  };
  expressApp.get('/', indexHTML);
  expressApp.get('/index.html', indexHTML);
  expressApp.get('/view/main.view.xml', function (req, res, next) {
    res.setHeader('content-type', 'text/xml');
    res.render(path.join(ui5ToolsPath, 'index', 'ui5', 'webapp', 'view', 'main'), {
      showTree: ui5toolsData.showTree,
      launchpad: ui5toolsData.launchpad,
    });
  });
  expressApp.use('/', express.static(path.join(ui5ToolsPath, 'index', 'ui5', 'webapp')));
  expressApp.get('/ui5tools.json', function (req, res) {
    if (fs.existsSync(path.join(baseDir, 'README.md'))) {
      let readmeMD = fs.readFileSync(path.join(baseDir, 'README.md'), 'utf8');
      ui5toolsData.readme = converter.makeHtml(readmeMD);
    }
    ui5toolsData.docs = [];
    if (fs.existsSync(path.join(baseDir, 'docs'))) {
      createDocsTree(path.join(baseDir, 'docs'), ui5toolsData.docs, config, ui5toolsData.showTree);
    }
    res.json(ui5toolsData);
  });
}

function createDocsTree(folderOrFilePath, nodes, config, tree) {
  let isDirectory = fs.statSync(folderOrFilePath).isDirectory();
  if (isDirectory) {
    let newNode = {};
    if (tree) {
      newNode = {
        folder: 1,
        name: path.basename(folderOrFilePath),
        nodes: [],
      };
      nodes.push(newNode);
    }
    fs.readdirSync(folderOrFilePath).forEach(function (subFolderPath) {
      createDocsTree(path.join(folderOrFilePath, subFolderPath), tree ? newNode.nodes : nodes, config, tree);
    });
  } else {
    switch (path.extname(folderOrFilePath)) {
      case '.md':
      case '.MD':
        nodes.push({
          folder: 0,
          markdown: converter.makeHtml(fs.readFileSync(folderOrFilePath, 'utf8')),
          name: tree ? path.basename(folderOrFilePath) : folderOrFilePath.replace(config.baseDir, ''),
          nodes: [],
        });
        break;
    }
  }
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
    let ui5toolsData = getOptionsVersion({}, config);
    let flpPath = path.join(ui5ToolsPath, 'index', 'flp', 'webapp');
    let indexFLP = function (req, res, next) {
      res.render(path.join(flpPath, 'index'), { theme: ui5toolsData.theme });
    };
    expressApp.get('/flp/', indexFLP);
    expressApp.get('/flp/index.html', indexFLP);
    expressApp.use('/flp/test-resources/sap/ushell/bootstrap/sandbox.js', function (req, res) {
      res.sendFile(path.join(flpPath, 'sandbox.js'));
    });
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
