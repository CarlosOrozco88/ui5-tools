import { RelativePattern, Uri, workspace } from 'vscode';
import Config from '../../Utils/Config';
import Log from '../../Utils/Log';

import { transformAsync, BabelFileResult, TransformOptions } from '@babel/core';
import presetEnv from '@babel/preset-env';

// @ts-ignore
import transformAsyncToPromises from 'babel-plugin-transform-async-to-promises';
// @ts-ignore
import transformRemoveConsole from 'babel-plugin-transform-remove-console';

import os from 'os';
import path from 'path';

export default {
  async build(folderPath: string, options: TransformOptions = {}): Promise<void> {
    if (!Config.builder('babelSources')) {
      return;
    }
    try {
      Log.builder(`Babelify files from ${folderPath}`);
      const innerOptions = {
        ...options,
      };

      const patternJs = new RelativePattern(folderPath, `**/*.js`);
      const babelSourcesExclude = Config.builder(`babelSourcesExclude`) as string;
      const jsFiles = await workspace.findFiles(patternJs, babelSourcesExclude);

      for (const jsUri of jsFiles) {
        const babelified = await this.transpileUri(jsUri, innerOptions);
        if (babelified?.code) {
          await workspace.fs.writeFile(jsUri, Buffer.from(babelified.code));
        }
      }
    } catch (error: any) {
      throw new Error(error);
    }
  },

  async transpileUriLive(fsUri: Uri, options: TransformOptions = {}): Promise<BabelFileResult | null> {
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
    return this.transpileUri(fsUri, innerOptions);
  },

  async transpileUri(fsUri: Uri, options: TransformOptions = {}): Promise<BabelFileResult | null> {
    const innerOptions = {
      ...options,
    };

    const jsFileRaw = await workspace.fs.readFile(fsUri);
    const jsFileString = jsFileRaw.toString();
    innerOptions.filename = innerOptions.filename ?? fsUri.fsPath;
    innerOptions.sourceFileName = innerOptions.sourceFileName ?? path.basename(fsUri.fsPath);

    const babelified = await this.transpileString(jsFileString, innerOptions);

    return babelified;
  },

  async transpileString(jsFileString: string, options: TransformOptions = {}): Promise<BabelFileResult | null> {
    const innerOptions = {
      ...options,
    };
    innerOptions.sourceMaps = innerOptions.sourceMaps ?? false;

    innerOptions.plugins = innerOptions.plugins ?? [
      [
        transformAsyncToPromises,
        {
          inlineHelpers: true,
        },
      ],
      [transformRemoveConsole],
    ];
    innerOptions.presets = innerOptions.presets ?? [
      [
        presetEnv,
        {
          targets: {
            browsers: 'last 2 versions, ie 11',
          },
        },
      ],
    ];

    const babelified: BabelFileResult | null = await transformAsync(jsFileString, innerOptions);
    if (babelified?.code) {
      babelified.code = babelified.code.replace(/\r\n|\r|\n/g, os.EOL);
    }

    return babelified;
  },
};
