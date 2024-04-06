import { workspace, RelativePattern, Uri } from 'vscode';
import express, { Request, Response } from 'express';
import path from 'path';
import { marked } from 'marked';

import Config from '../../Utils/ConfigVscode';
import Log from '../../Utils/LogVscode';
import { ServerOptions, Ui5ToolsData } from '../../Types/Types';
import Finder from '../../Project/Finder';
import Ui5 from '../../Utils/Ui5Vscode';
import Server from '../Server';

export default {
  // SERVER INDEX
  async set(oConfigParams: ServerOptions): Promise<void> {
    const { serverApp, ui5ToolsIndex, baseDir, ui5ToolsPath } = oConfigParams;
    Log.server('Mounting ui5-tools root page');

    serverApp.get(`/`, (req, res, next) => {
      const existBasePathInApp = Finder.ui5Projects.get('/');
      if (!existBasePathInApp) {
        res.redirect(`/${ui5ToolsIndex}/`);
      } else {
        next();
      }
    });

    const indexPath = path.join(ui5ToolsPath, 'static', 'index', 'ui5tools', 'webapp');
    const indexHTML = async (req: Request, res: Response) => {
      const oConfigParams = Server.getServerOptions() as ServerOptions;
      const ui5toolsData = await this.getUi5ToolsFile(oConfigParams);
      res.render(path.join(indexPath, 'index'), {
        theme: ui5toolsData.theme,
        edge: ui5toolsData.theme === 'sap_fiori_3' || ui5toolsData.theme === 'sap_horizon',
      });
    };
    // render index with correct theme
    serverApp.get(`/${ui5ToolsIndex}`, indexHTML);
    serverApp.get(`/${ui5ToolsIndex}/index.html`, indexHTML);

    // render view with correct list or tree
    serverApp.get(`/${ui5ToolsIndex}/view/docs.view.xml`, async (req, res) => {
      const oConfigParams = Server.getServerOptions() as ServerOptions;
      const ui5toolsData = await this.getUi5ToolsFile(oConfigParams);
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
      const oConfigParams = Server.getServerOptions() as ServerOptions;
      const ui5toolsData = await this.getUi5ToolsFile(oConfigParams);
      ui5toolsData.readme = await marked((await this.readFile(path.join(baseDir, 'README.md'))) || '');
      ui5toolsData.about = await marked((await this.readFile(path.join(ui5ToolsPath, 'README.md'))) || '');
      ui5toolsData.changelog = await marked((await this.readFile(path.join(ui5ToolsPath, 'CHANGELOG.md'))) || '');
      ui5toolsData.links = JSON.parse((await this.readFile(path.join(baseDir, 'links.json'))) || '[]');
      ui5toolsData.docs = await this.findDocs(baseDir, ui5toolsData.showTree);
      ui5toolsData.contributors = [
        {
          src: 'https://avatars.githubusercontent.com/u/11719827?v=4',
          tooltip: 'Carlos Orozco Jimenez',
          url: 'https://github.com/CarlosOrozco88',
        },
        {
          src: 'https://avatars.githubusercontent.com/u/33299683?v=4',
          tooltip: 'David Perez Bris',
          url: 'https://github.com/dperezbr',
        },
        {
          src: 'https://avatars.githubusercontent.com/u/145746607?v=4',
          tooltip: 'Santiago de Arriba Cortijo',
          url: 'https://github.com/Santi517',
        },
        {
          src: 'https://avatars.githubusercontent.com/u/18210819?v=4',
          tooltip: 'Joaquim Monserrat Companys',
          url: 'https://github.com/jeremies',
        },
      ];
      const sUi5ToolsData = JSON.stringify(ui5toolsData, null, 2);
      res.send(sUi5ToolsData);
    });
    return;
  },

  async getUi5ToolsFile({ isLaunchpadMounted }: ServerOptions) {
    const ui5Projects = await Finder.getAllUI5ProjectsArray();
    const ui5ProjectsSorted = ui5Projects.sort((p1, p2) => {
      return p1.folderName.localeCompare(p2.folderName);
    });
    const ui5toolsData: Ui5ToolsData = {
      ...Ui5.getOptionsVersion(),
      readme: '',
      about: '',
      changelog: '',
      launchpad: isLaunchpadMounted,
      links: [],
      contributors: [],
      docs: { aTree: [], oHashes: {} },
      ui5Projects: {
        all: ui5ProjectsSorted,
        application: ui5ProjectsSorted.filter(({ type }) => type === 'application'),
        component: ui5ProjectsSorted.filter(({ type }) => type === 'component'),
        library: ui5ProjectsSorted.filter(({ type }) => type === 'library'),
        card: ui5ProjectsSorted.filter(({ type }) => type === 'card'),
      },
      //@ts-ignore
      config: Config.general(),
    };
    return ui5toolsData;
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
