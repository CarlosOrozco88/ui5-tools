import { workspace, RelativePattern, Uri } from 'vscode';
import express from 'express';
import path from 'path';
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
    serverApp.get(`/${ui5ToolsIndex}/ui5tools.json`, async (req, res) => {
      ui5toolsData.readme = converter.makeHtml(await this.readFile(path.join(baseDir, 'README.md'), ''));
      ui5toolsData.links = JSON.parse(await this.readFile(path.join(baseDir, 'links.json'), '[]'));
      ui5toolsData.docs = await this.findDocs(baseDir, ui5toolsData.showTree);

      res.json(ui5toolsData);
    });
    return;
  },

  async readFile(sPath, defaultValue = undefined) {
    let oFile = defaultValue;
    try {
      let oFileBuffer = await workspace.fs.readFile(Uri.file(sPath));
      oFile = oFileBuffer.toString();
    } catch (oError) {
      oFile = defaultValue;
    }
    return oFile;
  },

  async findDocs(sBaseDirPath, bTree) {
    let aMDFilesPaths = await workspace.findFiles(
      new RelativePattern(sBaseDirPath, `**/*.{md,MD}`),
      new RelativePattern(sBaseDirPath, `**/{node_modules,.git}/`)
    );
    let aMDFilesPromises = [];
    aMDFilesPaths.forEach((oManifest) => {
      let oMDFile = workspace.fs.readFile(Uri.file(oManifest.fsPath));
      aMDFilesPromises.push(oMDFile);
    });
    let aMDFilesBuffers = await Promise.all(aMDFilesPromises);
    let aMDFiles = aMDFilesBuffers.map((oBuffer) => oBuffer.toString());

    let oFolders = {};
    let aTree = [];
    aMDFiles.forEach((sFile, i) => {
      var oPath = aMDFilesPaths[i];
      var sPath = oPath.fsPath.replace(sBaseDirPath, '');
      var aPaths = sPath.split(path.sep);
      let iLength = aPaths.length - 1;
      let sFolderPath = '';
      aPaths.forEach((sFolderFile, j) => {
        if (sFolderFile) {
          let sHash = sFolderPath + path.sep + sFolderFile;

          if (!oFolders[sHash]) {
            let bIsFolder = j != iLength;
            oFolders[sHash] = {
              folder: bIsFolder,
              name: sFolderFile,
              markdown: bIsFolder ? undefined : '<div>' + converter.makeHtml(sFile) + '</div>',
              path: sHash,
              nodes: [],
            };

            if (bTree && sFolderPath) {
              oFolders[sFolderPath].nodes.push(oFolders[sHash]);
            } else if (bTree || !bIsFolder) {
              aTree.push(oFolders[sHash]);
            }
          }

          sFolderPath = sHash;
        }
      });
    });

    return aTree;
  },
};
