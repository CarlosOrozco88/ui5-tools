import { workspace, RelativePattern, Uri } from 'vscode';
import express from 'express';
import path from 'path';
import showdown from 'showdown';

import Utils from '../../Utils/Utils';
import Config from '../../Utils/Config';

const converter = new showdown.Converter();

export default {
  // SERVER INDEX
  async set({ serverApp, ui5Apps, ui5ToolsIndex, baseDir, ui5ToolsPath, isLaunchpadMounted }) {
    Utils.logOutputServer('Mounting ui5-tools root page');

    let existBasePathInApp = ui5Apps.find((ui5App) => {
      return ui5App.appServerPath === '/';
    });
    if (!existBasePathInApp) {
      serverApp.get(`/`, (req, res) => {
        res.redirect(`/${ui5ToolsIndex}/`);
      });
    }

    let ui5toolsData = {
      ...Utils.getOptionsVersion(),
      readme: '',
      launchpad: isLaunchpadMounted,
      links: [],
      docs: { aTree: [], oHashes: {} },
      ui5Apps: {
        application: ui5Apps.filter((app) => app.manifest['sap.app'].type === 'application'),
        component: ui5Apps.filter((app) => app.manifest['sap.app'].type === 'component'),
        library: ui5Apps.filter((app) => app.manifest['sap.app'].type === 'library'),
        card: ui5Apps.filter((app) => app.manifest['sap.app'].type === 'card'),
      },
      config: Config.general(),
    };

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
    serverApp.use(`/${ui5ToolsIndex}/static`, express.static(path.join(ui5ToolsPath, 'static')));

    // Serve app data
    serverApp.get(`/${ui5ToolsIndex}/ui5tools.json`, async (req, res) => {
      ui5toolsData.readme = converter.makeHtml(await this.readFile(path.join(baseDir, 'README.md'), ''));
      ui5toolsData.about = converter.makeHtml(await this.readFile(path.join(ui5ToolsPath, 'README.md'), ''));
      ui5toolsData.changelog = converter.makeHtml(await this.readFile(path.join(ui5ToolsPath, 'CHANGELOG.md'), ''));
      ui5toolsData.links = JSON.parse(await this.readFile(path.join(baseDir, 'links.json'), '[]'));
      ui5toolsData.docs = await this.findDocs(baseDir, ui5toolsData.showTree);
      ui5toolsData.contributors = [
        {
          src: 'https://avatars.githubusercontent.com/u/11719827?v=4',
          tooltip: 'Carlos Orozco Jimenez',
          url: 'https://github.com/CarlosOrozco88',
        },
        {
          src: 'https://avatars.githubusercontent.com/u/18210819?v=4',
          tooltip: 'Joaquim Monserrat Companys',
          url: 'https://github.com/jeremies',
        },
      ];

      res.send(JSON.stringify(ui5toolsData, null, 2));
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
    let oHashes = {};
    aMDFiles.forEach((sFile, i) => {
      let oPath = aMDFilesPaths[i];
      let sPath = oPath.fsPath.replace(sBaseDirPath, '');
      let aPaths = sPath.split(path.sep);
      let iLength = aPaths.length - 1;
      let sFolderPath = '';
      aPaths.forEach((sFolderFile, j) => {
        if (sFolderFile) {
          let sPath = sFolderPath + path.sep + sFolderFile;
          let sHash = sPath.split(path.sep).join('-');

          if (!oFolders[sPath]) {
            let bIsFolder = j != iLength;
            oFolders[sPath] = {
              folder: bIsFolder,
              name: sFolderFile,
              markdown: bIsFolder ? undefined : '<div>' + converter.makeHtml(sFile) + '</div>',
              path: sPath,
              hash: sHash,
              nodes: [],
            };
            oHashes[sHash] = oFolders[sPath];

            if (bTree && sFolderPath) {
              oFolders[sFolderPath].nodes.push(oFolders[sPath]);
            } else if (bTree || !bIsFolder) {
              aTree.push(oFolders[sPath]);
            }
          }

          sFolderPath = sPath;
        }
      });
    });

    return {
      aTree: aTree,
      oHashes: oHashes,
    };
  },
};
