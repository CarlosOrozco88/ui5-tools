import { RelativePattern, Uri, workspace } from 'vscode';
import { KeysValuesConfig } from '../../Types/Types';
import Config from '../../Utils/ConfigVscode';

import dayjs from 'dayjs';
import Log from '../../Utils/LogVscode';

export default {
  /**
   * Replace all strings
   */
  async strings(folderPath: string): Promise<void> {
    const replaceExtensions = Config.builder('replaceExtensions');
    const pattern = new RelativePattern(folderPath, `**/*.{${replaceExtensions}}`);
    const files: Array<Uri> = await workspace.findFiles(pattern);

    const calculedKeys: Record<string, string> = this.stringsValue();
    const aCalculedKeys: [string, string][] = Object.entries(calculedKeys);

    if (files.length) {
      Log.builder(`Replacing strings from ${folderPath}`);
      try {
        for (let i = 0; i < files.length; i++) {
          await this.stringFiles(files[i], aCalculedKeys);
        }
      } catch (error: any) {
        throw new Error(error);
      }
    }
  },

  async stringFiles(file: Uri, aCalculedKeys: [string, string][]): Promise<void> {
    const rawFile = await workspace.fs.readFile(file);
    const stringfile = rawFile.toString();
    let newFile = stringfile;

    for (const [key, value] of aCalculedKeys) {
      newFile = newFile.replace(new RegExp('(<%){1}[\\s]*(' + key + '){1}[\\s]*(%>){1}', 'g'), value);
    }

    if (newFile !== stringfile) {
      await workspace.fs.writeFile(file, Buffer.from(newFile));
    }
  },

  stringsValue(): Record<string, string> {
    // @ts-ignore
    const keysValues: Array<any> = Config.builder('replaceKeysValues');
    const computedKeys: Record<string, string> = {};

    const now = dayjs();

    const aComputedDate = keysValues.filter(({ value }: KeysValuesConfig) => value.indexOf('COMPUTED_DATE_') === 0);

    aComputedDate.forEach(({ key, value, param }) => {
      const sKey = value.replace('COMPUTED_DATE_', '');
      let sValue = '';
      switch (sKey) {
        case 'TIMESTAMP':
          sValue = String(now.valueOf());
          break;
        case 'ISO':
          sValue = now.toISOString();
          break;
        case 'DMY':
          sValue = now.format('DD/MM/YYYY HH:mm');
          break;
        case 'YMD':
          sValue = now.format('YYYY/MM/DD HH:mm');
          break;
        case 'MYD':
          sValue = now.format('MM/YYYY/DD HH:mm');
          break;
        case 'FORMATTED':
          sValue = param ? now.format(param) : now.toISOString();
          break;
      }
      computedKeys[key] = sValue;
    });

    return computedKeys;
  },
};
