import { workspace, RelativePattern, Uri } from 'vscode';
import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { marked } from 'marked';

import Utils from '../../Utils/Utils';
import Config from '../../Utils/Config';
import Log from '../../Utils/Log';
import { ServerOptions, Ui5ToolsData } from '../../Types/Types';

export default {
  // SERVER INDEX
  async set({
    serverApp,
    ui5Apps,
    ui5ToolsIndex,
    baseDir,
    ui5ToolsPath,
    isLaunchpadMounted,
  }: ServerOptions): Promise<void> {
    Log.server('Mounting ui5-tools root page');

    const existBasePathInApp = ui5Apps.find((ui5App) => {
      return ui5App.appServerPath === '/';
    });
    if (!existBasePathInApp) {
      serverApp.get(`/`, (req, res) => {
        res.redirect(`/${ui5ToolsIndex}/`);
      });
    }

    const ui5toolsData: Ui5ToolsData = {
      ...Utils.getOptionsVersion(),
      readme: '',
      about: '',
      changelog: '',
      launchpad: isLaunchpadMounted,
      links: [],
      contributors: [],
      docs: { aTree: [], oHashes: {} },
      ui5Apps: {
        application: ui5Apps.filter((app) => app.manifest['sap.app'].type === 'application'),
        component: ui5Apps.filter((app) => app.manifest['sap.app'].type === 'component'),
        library: ui5Apps.filter((app) => app.manifest['sap.app'].type === 'library'),
        card: ui5Apps.filter((app) => app.manifest['sap.app'].type === 'card'),
      },
      //@ts-ignore
      config: Config.general(),
    };

    const indexPath = path.join(ui5ToolsPath, 'static', 'index', 'ui5tools', 'webapp');
    const indexHTML = (req: Request, res: Response, next: NextFunction) => {
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
      ui5toolsData.readme = marked((await this.readFile(path.join(baseDir, 'README.md'))) || '');
      ui5toolsData.about = marked((await this.readFile(path.join(ui5ToolsPath, 'README.md'))) || '');
      ui5toolsData.changelog = marked((await this.readFile(path.join(ui5ToolsPath, 'CHANGELOG.md'))) || '');
      ui5toolsData.links = JSON.parse((await this.readFile(path.join(baseDir, 'links.json'))) || '[]');
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

  async readFile(sPath: string): Promise<undefined | string> {
    let oFile: undefined | string;
    try {
      const oFileBuffer = await workspace.fs.readFile(Uri.file(sPath));
      oFile = oFileBuffer.toString();
    } catch (oError) {
      // err
    }
    return oFile;
  },

  async findDocs(sBaseDirPath: string, bTree: boolean): Promise<{ aTree: Array<any>; oHashes: Record<string, any> }> {
    const aMDFilesPaths = await workspace.findFiles(
      new RelativePattern(sBaseDirPath, `**/*.{md,MD}`),
      new RelativePattern(sBaseDirPath, `**/{node_modules,.git}/`)
    );
    const aMDFilesPromises: Array<Thenable<Uint8Array>> = [];
    aMDFilesPaths.forEach((oManifest) => {
      const oMDFile = workspace.fs.readFile(Uri.file(oManifest.fsPath));
      aMDFilesPromises.push(oMDFile);
    });
    const aMDFilesBuffers = await Promise.all(aMDFilesPromises);
    const aMDFiles = aMDFilesBuffers.map((oBuffer) => oBuffer.toString());

    const oFolders: Record<string, any> = {};
    const aTree: Array<Record<string, any>> = [];
    const oHashes: Record<string, any> = {};
    aMDFiles.forEach((sFile, i) => {
      const oPath = aMDFilesPaths[i];
      const sPath = oPath.fsPath.replace(sBaseDirPath, '');
      const aPaths = sPath.split(path.sep);
      const iLength = aPaths.length - 1;
      let sFolderPath = '';
      aPaths.forEach((sFolderFile, j) => {
        if (sFolderFile) {
          const sPath = sFolderPath + path.sep + sFolderFile;
          const sHash = sPath.split(path.sep).join('-');

          if (!oFolders[sPath]) {
            const bIsFolder = j != iLength;
            oFolders[sPath] = {
              folder: bIsFolder,
              name: sFolderFile,
              markdown: bIsFolder ? undefined : '<div>' + marked(sFile) + '</div>',
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
