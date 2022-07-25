import { RelativePattern, Uri, workspace } from 'vscode';
import Config from '../../Utils/ConfigVscode';
import Log from '../../Utils/LogVscode';

export default {
  /**
   * Create -dbg.js files
   */
  async build(srcPath: string, folderPath: string): Promise<void> {
    if (Config.builder('debugSources')) {
      try {
        Log.builder(`Create dbg files ${folderPath}`);
        // Create -dbg files
        const patternJs = new RelativePattern(srcPath, `**/*.js`);
        const jsFiles = await workspace.findFiles(patternJs);

        for (let i = 0; i < jsFiles.length; i++) {
          const uriOrigJs = Uri.file(jsFiles[i].fsPath);
          const uriDestJs = Uri.file(jsFiles[i].fsPath.replace(srcPath, folderPath).replace('.js', '-dbg.js'));
          await workspace.fs.copy(uriOrigJs, uriDestJs, {
            overwrite: true,
          });
        }
      } catch (error: any) {
        throw new Error(error);
      }
    }
  },
};
