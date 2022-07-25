import path from 'path';
import less from 'less';
//@ts-ignore
import lessOpenUI5 from 'less-openui5';

import { RelativePattern, Uri, workspace } from 'vscode';
import Log from '../../Utils/LogVscode';
import Ui5Project from '../Ui5Project';

const lessOpenUI5Builder = new lessOpenUI5.Builder({});

/**
 * Cleans unneeded uri files
 */
const Less = {
  /**
   * Compile less from destPath
   */
  async build(ui5Project: Ui5Project, srcPath: string, destPath: string): Promise<Array<string>> {
    const sLibraryFile = await Less.buildLibrary(ui5Project, srcPath, destPath);
    const sComponentFile = await Less.buildComponent(ui5Project, srcPath, destPath);
    const aFiles = [];
    if (sLibraryFile) aFiles.push(sLibraryFile);
    if (sComponentFile) aFiles.push(sComponentFile);
    return aFiles;
  },

  /**
   * Generate css for library
   */
  async buildLibrary(ui5Project: Ui5Project, srcPath: string, destPath: string) {
    const patternLessLibrary = new RelativePattern(srcPath, `**/library.source.less`);
    const lessFilesLibrary = await workspace.findFiles(patternLessLibrary);
    let filePath = undefined;

    for (const lessfile of lessFilesLibrary) {
      Log.builder(`Compiling less theme from ${lessfile.fsPath}`);
      const output = await lessOpenUI5Builder.build({
        lessInputPath: lessfile.fsPath,
        library: {
          name: ui5Project.namespace,
        },
      });
      lessOpenUI5Builder.clearCache();

      const cFSPath = lessfile.fsPath.replace('library.source.less', '');

      const cFSPathLibrary = path.join(cFSPath, 'library.css').replace(srcPath, destPath);
      filePath = filePath ?? cFSPathLibrary;
      await workspace.fs.writeFile(Uri.file(cFSPathLibrary), Buffer.from(output.css));

      const cFSPathLibraryRTL = path.join(cFSPath, 'library-RTL.css').replace(srcPath, destPath);
      await workspace.fs.writeFile(Uri.file(cFSPathLibraryRTL), Buffer.from(output.cssRtl));

      const cFSPathLibraryParameters = path.join(cFSPath, 'library-parameters.json').replace(srcPath, destPath);
      await workspace.fs.writeFile(Uri.file(cFSPathLibraryParameters), Buffer.from(JSON.stringify(output.variables)));
    }
    return filePath;
  },

  /**
   * Generate css for components
   */
  async buildComponent(ui5Project: Ui5Project, srcPath: string, destPath: string) {
    const patternLessComponent = new RelativePattern(srcPath, `**/{styles,${ui5Project.folderName}}.less`);
    const lessFilesComponent = await workspace.findFiles(patternLessComponent);
    let filePath = undefined;

    for (const lessfileUri of lessFilesComponent) {
      Log.builder(`Compiling less file from ${lessfileUri.fsPath}`);
      const lessFile = await workspace.fs.readFile(Uri.file(lessfileUri.fsPath));
      const lesFilePath = lessfileUri.fsPath;
      const output = await less.render(lessFile.toString(), {
        filename: lesFilePath,
      });
      const cssFilePath = lesFilePath.replace('.less', '.css');
      filePath = filePath ?? cssFilePath;
      const cFSPath = cssFilePath.replace(srcPath, destPath);
      await workspace.fs.writeFile(Uri.file(cFSPath), Buffer.from(output.css));
    }
    return filePath;
  },
};
export default Less;
