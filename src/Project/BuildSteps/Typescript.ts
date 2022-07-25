import { RelativePattern, Uri, workspace } from 'vscode';
import Log from '../../Utils/LogVscode';

import { transformAsync, BabelFileResult, TransformOptions } from '@babel/core';
// @ts-ignore
import presetTypescript from '@babel/preset-typescript';
// @ts-ignore
import presetUi5 from 'babel-preset-transform-ui5';
// @ts-ignore
import transformAsyncToPromises from 'babel-plugin-transform-async-to-promises';

import os from 'os';
import path from 'path';

export default {
  async build(folderPath: string, options: TransformOptions = {}): Promise<void> {
    try {
      Log.builder(`Transpile ts files from ${folderPath}`);
      const innerOptions = {
        ...options,
      };

      const patternJs = new RelativePattern(folderPath, `**/*.ts`);
      const tsFiles = await workspace.findFiles(patternJs);

      for (const tsUri of tsFiles) {
        await this.transpileUriToFile(tsUri, innerOptions);
      }
    } catch (error: any) {
      throw new Error(error);
    }
  },

  async transpileUriLive(tsUri: Uri, options: TransformOptions = {}): Promise<BabelFileResult | null> {
    const innerOptions = {
      ...options,
    };

    innerOptions.plugins = innerOptions.plugins ?? [
      [
        transformAsyncToPromises,
        {
          inlineHelpers: true,
        },
      ],
    ];
    innerOptions.sourceMaps = 'inline';

    return this.transpileUri(tsUri, innerOptions);
  },

  async transpileUriToFile(tsUri: Uri, options: TransformOptions = {}) {
    const innerOptions = {
      ...options,
    };

    const babelified = await this.transpileUri(tsUri, innerOptions);
    if (babelified?.code) {
      let tsString = babelified.code;
      const jsPath = tsUri.fsPath.replace('.ts', '.js');
      const jsUri = Uri.file(jsPath);
      await workspace.fs.rename(tsUri, jsUri, { overwrite: true });

      if (innerOptions.sourceMaps === true) {
        const mapPath = `${jsPath}.map`;
        const mapUri = Uri.file(mapPath);
        const mapString = JSON.stringify(babelified.map, null, 2);
        await workspace.fs.writeFile(mapUri, Buffer.from(mapString));
        const mapName = path.basename(mapPath);
        tsString += os.EOL;
        tsString += `//# sourceMappingURL=${mapName}`;
      }

      await workspace.fs.writeFile(jsUri, Buffer.from(tsString));
    }
  },

  async transpileUri(tsUri: Uri, options: TransformOptions = {}): Promise<BabelFileResult | null> {
    const innerOptions = {
      ...options,
    };

    const tsFileRaw = await workspace.fs.readFile(tsUri);
    const tsString = tsFileRaw.toString();
    innerOptions.filename = innerOptions.filename ?? tsUri.fsPath;
    innerOptions.sourceFileName = innerOptions.sourceFileName ?? path.basename(tsUri.fsPath);

    const babelified = await this.transpileString(tsString, innerOptions);

    return babelified;
  },

  async transpileString(tsString: string, options: TransformOptions = {}): Promise<BabelFileResult | null> {
    const innerOptions = {
      ...options,
    };

    innerOptions.sourceMaps = innerOptions.sourceMaps ?? false;

    innerOptions.presets = innerOptions.presets ?? [
      [presetTypescript, {}],
      [presetUi5, {}],
    ];

    const babelified: BabelFileResult | null = await transformAsync(tsString, innerOptions);

    if (babelified?.code) {
      babelified.code = babelified.code.replace(/\r\n|\r|\n/g, os.EOL);
    }

    return babelified;
  },
};
