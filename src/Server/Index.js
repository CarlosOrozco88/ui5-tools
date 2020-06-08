import express from 'express';
import path from 'path';
import fs from 'fs';
import showdown from 'showdown';

import Utils from '../Utils/Utils';
import Proxy from '../Server/Proxy';

const converter = new showdown.Converter();

async function setIndexMiddleware(expressApp, config) {
  setServerIndexMiddleware(expressApp, config);
  setLaunchpadMiddleware(expressApp, config);
}

// SERVER INDEX
function setServerIndexMiddleware(expressApp, config) {
  let { ui5ToolsPath, baseDir } = config;

  let ui5toolsData = {
    readme: '',
    launchpad: isLaunchpadMounted(config),
    links: [],
    docs: [],
    config,
  };
  Utils.getOptionsVersion(ui5toolsData, config);

  let indexPath = path.join(ui5ToolsPath, 'static', 'index', 'ui5', 'webapp');
  let indexHTML = function (req, res, next) {
    res.render(path.join(indexPath, 'index'), { theme: ui5toolsData.theme });
  };
  // render index with correct theme
  expressApp.get('/', indexHTML);
  expressApp.get('/index.html', indexHTML);

  // render view with correct list or tree
  expressApp.get('/view/docs.view.xml', function (req, res, next) {
    res.setHeader('content-type', 'text/xml');
    res.render(path.join(indexPath, 'view', 'docs'), {
      showTree: ui5toolsData.showTree,
      launchpad: ui5toolsData.launchpad,
    });
  });

  // Serve app files
  expressApp.use('/', express.static(path.join(ui5ToolsPath, 'static', 'index', 'ui5', 'webapp')));

  // Serve app data
  expressApp.get('/ui5tools.json', function (req, res) {
    if (fs.existsSync(path.join(baseDir, 'README.md'))) {
      let readmeMD = fs.readFileSync(path.join(baseDir, 'README.md'), 'utf8');
      ui5toolsData.readme = converter.makeHtml(readmeMD);
    }
    if (fs.existsSync(path.join(baseDir, 'links.json'))) {
      let linksJSON = fs.readFileSync(path.join(baseDir, 'links.json'), 'utf8');
      ui5toolsData.links = JSON.parse(linksJSON);
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
        folder: true,
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
          folder: false,
          markdown: '<div>' + converter.makeHtml(fs.readFileSync(folderOrFilePath, 'utf8')) + '</div>',
          name: tree ? path.basename(folderOrFilePath) : folderOrFilePath.replace(config.baseDir, ''),
          path: folderOrFilePath.replace(config.baseDir, ''),
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
    let { ui5ToolsPath, baseDir, manifests, ui5Version } = config;

    // DONT MOUNT RESOURCE ROOTS TO SIMULATE LAUNCHPAD
    // Object.entries(manifests).forEach(([folder, manifest]) => {
    //   fioriSandboxConfig.modulePaths[manifest['sap.app'].id] = `../${folder}`;
    // });

    let ui5toolsData = Utils.getOptionsVersion();
    let flpPath = path.join(ui5ToolsPath, 'static', 'index', 'flp');

    let indexFLP = function (req, res, next) {
      res.render(path.join(flpPath, 'index'), { theme: ui5toolsData.theme });
    };
    expressApp.get('/flp/', indexFLP);
    expressApp.get('/flp/index.html', indexFLP);

    // expressApp.use('/flp/test-resources/sap/ushell/bootstrap/sandbox.js', function (req, res) {
    //   res.sendFile(path.join(flpPath, 'sandbox.js'));
    // });

    let fioriSandboxConfig = {
      modulePaths: {},
      applications: {},
    };
    Object.entries(manifests).forEach(([folder, manifest]) => {
      let hash = 'ui5tools-' + folder.toLowerCase();
      fioriSandboxConfig.applications[hash] = {
        additionalInformation: `SAPUI5.Component=${manifest['sap.app'].id}`,
        applicationType: 'SAPUI5',
        url: `../${folder}/`,
        description: manifest['sap.app'].id,
        title: folder,
      };
    });

    expressApp.get('/flp/test-resources/sap/ushell/shells/sandbox/fioriSandboxConfig.json', function (req, res) {
      res.json(fioriSandboxConfig);
    });
    expressApp.get('/appconfig/fioriSandboxConfig.json', function (req, res) {
      res.sendFile(path.join(baseDir, 'fioriSandboxConfig.json'));
    });

    Proxy.setTestResourcesProxy(expressApp, config);
  }
}

export default {
  setIndexMiddleware,
};
