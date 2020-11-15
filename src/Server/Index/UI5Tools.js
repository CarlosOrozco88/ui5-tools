import express from 'express';
import path from 'path';
import fs from 'fs';
import showdown from 'showdown';

import Utils from '../../Utils/Utils';
import Config from '../../Utils/Config';

const converter = new showdown.Converter();

export default {
  // SERVER INDEX
  async set(serverApp) {
    Utils.logOutputServer('Mounting ui5-tools root page');
    let ui5ToolsIndex = Utils.getUi5ToolsIndexFolder();
    let ui5Apps = await Utils.getAllUI5Apps();
    let existBasePathInApp = ui5Apps.find((ui5App) => {
      return ui5App.appServerPath === '/';
    });
    if (!existBasePathInApp) {
      serverApp.get(`/`, (req, res) => {
        res.redirect(`/${ui5ToolsIndex}/`);
      });
    }

    let baseDir = Utils.getWorkspaceRootPath();
    let ui5ToolsPath = Utils.getUi5ToolsInfo().extensionUri.fsPath;

    let ui5toolsData = {
      readme: '',
      launchpad: Utils.isLaunchpadMounted(),
      links: [],
      docs: [],
      ui5Apps: ui5Apps,
      config: Config.general(),
    };
    Utils.getOptionsVersion(ui5toolsData);

    let indexPath = path.join(ui5ToolsPath, 'static', 'index', 'ui5tools', 'webapp');
    let indexHTML = (req, res, next) => {
      res.render(path.join(indexPath, 'index'), {
        theme: ui5toolsData.theme,
        edge: ui5toolsData.theme === 'sap_fiori_3',
      });
    };
    // render index with correct theme
    serverApp.get(`/${ui5ToolsIndex}`, indexHTML);
    serverApp.get(`/${ui5ToolsIndex}/index.html`, indexHTML);

    // render view with correct list or tree
    serverApp.get(`/${ui5ToolsIndex}/view/docs.view.xml`, (req, res, next) => {
      res.setHeader('content-type', 'text/xml');
      res.render(path.join(indexPath, 'view', 'docs'), {
        showTree: ui5toolsData.showTree,
        launchpad: ui5toolsData.launchpad,
      });
    });

    // Serve app files
    serverApp.use(
      `/${ui5ToolsIndex}`,
      express.static(path.join(ui5ToolsPath, 'static', 'index', 'ui5tools', 'webapp'))
    );

    // Serve app data
    serverApp.get(`/${ui5ToolsIndex}/ui5tools.json`, (req, res) => {
      ui5toolsData.readme = '';
      if (fs.existsSync(path.join(baseDir, 'README.md'))) {
        let readmeMD = fs.readFileSync(path.join(baseDir, 'README.md'), 'utf8');
        ui5toolsData.readme = converter.makeHtml(readmeMD);
      }

      ui5toolsData.links = [];
      if (fs.existsSync(path.join(baseDir, 'links.json'))) {
        let linksJSON = fs.readFileSync(path.join(baseDir, 'links.json'), 'utf8');
        ui5toolsData.links = JSON.parse(linksJSON);
      }

      ui5toolsData.docs = [];
      if (fs.existsSync(path.join(baseDir, 'docs'))) {
        this.createDocsTree(path.join(baseDir, 'docs'), ui5toolsData.docs, baseDir, ui5toolsData.showTree);
      }
      res.json(ui5toolsData);
    });
    return;
  },

  createDocsTree(folderOrFilePath, nodes, baseDir, tree) {
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
      fs.readdirSync(folderOrFilePath).forEach((subFolderPath) => {
        this.createDocsTree(path.join(folderOrFilePath, subFolderPath), tree ? newNode.nodes : nodes, baseDir, tree);
      });
    } else {
      switch (path.extname(folderOrFilePath)) {
        case '.md':
        case '.MD':
          nodes.push({
            folder: false,
            markdown: '<div>' + converter.makeHtml(fs.readFileSync(folderOrFilePath, 'utf8')) + '</div>',
            name: tree ? path.basename(folderOrFilePath) : folderOrFilePath.replace(baseDir, ''),
            path: folderOrFilePath.replace(baseDir, ''),
            nodes: [],
          });
          break;
      }
    }
  },
};
