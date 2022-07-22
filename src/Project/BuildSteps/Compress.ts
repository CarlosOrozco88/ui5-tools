import { RelativePattern, workspace } from 'vscode';
import Config from '../../Utils/Config';
import Log from '../../Utils/Log';

import { minify, MinifyOutput } from 'terser';
import { pd as prettyData } from 'pretty-data';
import path from 'path';
const xmlHtmlPrePattern = /<(?:\w+:)?pre>/;

export default {
  /**
   * Compress files from folderPath
   */
  async all(fsPath: string): Promise<void> {
    if (Config.builder('uglifySources')) {
      try {
        Log.builder(`Compress files from ${fsPath}`);

        await this.js(fsPath);
        await this.json(fsPath);
        await this.xml(fsPath);
        await this.css(fsPath);
      } catch (error: any) {
        throw new Error(error);
      }
    }
  },

  async js(fsPath: string): Promise<void> {
    if (Config.builder('uglifySources')) {
      // Compress js files
      const patternJs = new RelativePattern(fsPath, `**/*.js`);
      const uglifySourcesExclude = Config.builder(`uglifySourcesExclude`) as string;
      const jsFiles = await workspace.findFiles(patternJs, uglifySourcesExclude);

      for (const uri of jsFiles) {
        if (!path.basename(uri.fsPath).endsWith('-dbg.js')) {
          const jsFileRaw = await workspace.fs.readFile(uri);

          const jsFileMinified: MinifyOutput = await minify(jsFileRaw.toString());
          if (jsFileMinified.code) {
            await workspace.fs.writeFile(uri, Buffer.from(jsFileMinified.code));
          }
        }
      }
    }
  },

  async json(fsPath: string): Promise<void> {
    if (Config.builder('uglifySources')) {
      // Compress json files
      const patternJson = new RelativePattern(fsPath, `**/*.json`);
      const jsonFiles = await workspace.findFiles(patternJson);

      for (const uri of jsonFiles) {
        const jsonFileRaw = await workspace.fs.readFile(uri);

        const jsFileMinified = prettyData.jsonmin(jsonFileRaw.toString());
        await workspace.fs.writeFile(uri, Buffer.from(jsFileMinified));
      }
    }
  },

  async xml(fsPath: string): Promise<void> {
    if (Config.builder('uglifySources')) {
      // Compress xml files
      const patternXml = new RelativePattern(fsPath, `**/*.xml`);
      const xmlFiles = await workspace.findFiles(patternXml);

      for (const uri of xmlFiles) {
        const cssFileRaw = await workspace.fs.readFile(uri);

        if (!xmlHtmlPrePattern.test(cssFileRaw.toString())) {
          const xmlFileMinified = prettyData.xmlmin(cssFileRaw.toString(), false);
          await workspace.fs.writeFile(uri, Buffer.from(xmlFileMinified));
        }
      }
    }
  },

  async css(fsPath: string): Promise<void> {
    if (Config.builder('uglifySources')) {
      // Compress css files
      const patternCss = new RelativePattern(fsPath, `**/*.css`);
      const cssFiles = await workspace.findFiles(patternCss);

      for (const uri of cssFiles) {
        const cssFileRaw = await workspace.fs.readFile(uri);

        const cssFileMinified = prettyData.cssmin(cssFileRaw.toString());
        await workspace.fs.writeFile(uri, Buffer.from(cssFileMinified));
      }
    }
  },
};
