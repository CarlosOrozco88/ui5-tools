import { RelativePattern, Uri, workspace } from 'vscode';
import Config from '../../Utils/ConfigVscode';
import Log from '../../Utils/LogVscode';

/**
 * Matches the extension of a javascript resource, capturing UI5 double extensions
 * such as `.controller.js` so that the `-dbg` marker can be placed in front of them.
 */
const jsExtension = /(\.controller)?\.js$/;

/**
 * Matches a debug file path as produced by `getDebugFilePath`
 */
const debugJsExtension = /-dbg(\.controller)?\.js$/;

/**
 * Returns the debug file path of a javascript resource,
 * e.g. `Worklist.controller.js` -> `Worklist-dbg.controller.js`
 */
export function getDebugFilePath(filePath: string): string {
  return filePath.replace(jsExtension, '-dbg$1.js');
}

/**
 * Checks if the given path belongs to a debug file created while building
 */
export function isDebugFilePath(filePath: string): boolean {
  return debugJsExtension.test(filePath);
}

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
          const sPath = jsFiles[i].fsPath;
          const uriOrigJs = Uri.file(sPath);
          const uriDestJs = Uri.file(getDebugFilePath(sPath.replace(srcPath, folderPath)));

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
