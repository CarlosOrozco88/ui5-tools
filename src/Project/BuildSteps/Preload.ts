import path from 'path';
import { Uri, workspace } from 'vscode';
import Ui5Project from '../Ui5Project';
import Config from '../../Utils/ConfigVscode';
import Log from '../../Utils/LogVscode';

//@ts-ignore
import preload from 'openui5-preload';
import Ui5 from '../../Utils/Ui5Vscode';

export default {
  async build(ui5Project: Ui5Project, srcPath: string, destPath: string): Promise<void> {
    const { isLibrary, namespace } = ui5Project;

    Log.builder(`Create preload into ${destPath}`);
    const fileName = isLibrary ? 'library.js' : 'Component.js';
    const componentUri = Uri.file(path.join(srcPath, fileName));

    try {
      await workspace.fs.readFile(componentUri);
    } catch (oError) {
      Log.builder(`${fileName} not found in path ${srcPath}, skiping preload creation...`);
      return;
    }

    const { compatVersion } = Ui5.getOptionsVersion();
    const namespaceBars = namespace.split('.').join('/');
    const preloadSrc = Config.builder('preloadSrc');
    const uglifyPreload = Config.builder('uglifyPreload');

    await preload({
      resources: {
        cwd: destPath,
        prefix: namespaceBars,
        src: preloadSrc,
      },
      dest: destPath,
      compatVersion: compatVersion,
      compress: uglifyPreload,
      log: false,
      components: !isLibrary ? namespaceBars : false,
      libraries: isLibrary ? namespaceBars : false,
    });
  },
};
