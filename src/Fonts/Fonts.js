import { generateFonts, FontAssetType, OtherAssetType } from 'fantasticon';
import { window, workspace, Uri, ProgressLocation } from 'vscode';
import path from 'path';
import fs from 'fs';
import https from 'https';
import Handlebars from 'handlebars';

import Utils from '../Utils/Utils';
import assert from 'assert';

export default {
  async askFontToGenerate() {
    let oFontConfig = undefined;

    try {
      Utils.logOutputFont(`Asking project to deploy`);
      let ui5Apps = await Utils.getAllUI5Apps();

      let aConfigPromises = [];
      ui5Apps.forEach((app) => {
        aConfigPromises.push(Utils.getUi5ToolsFile(app));
      });

      assert(aConfigPromises.length, 'Theres is no font configured');

      let aConfigFiles = await Promise.all(aConfigPromises);
      let aProjectFonts = aConfigFiles
        .map((oConfigFile, i) => {
          return { configFile: oConfigFile, ui5App: ui5Apps[i] };
        })
        .filter((oConfigApp) => oConfigApp.configFile?.fonts?.length > 0)
        .map((oConfigApp) => {
          return {
            fonts: oConfigApp.configFile.fonts,
            ui5App: oConfigApp.ui5App,
          };
        });
      let aFonts = [];
      let qpOptions = [];
      aProjectFonts.forEach(({ fonts, ui5App }) => {
        aFonts = aFonts.concat(
          fonts.map((font) => {
            qpOptions.push({
              label: `${font.name} | ${font.type}`,
              description: `${font.name} from ${ui5App.namespace}`,
            });
            return {
              font: font,
              ui5App: ui5App,
            };
          })
        );
      });
      console.log(aFonts);

      if (aFonts.length > 1) {
        let fontToGenerate = await new Promise(async (resolve, reject) => {
          let fontToGenerateQp = await window.createQuickPick();
          fontToGenerateQp.title = 'ui5-tools > Fonts > Select font';
          fontToGenerateQp.items = qpOptions;
          fontToGenerateQp.placeholder = 'Select font to generate';
          fontToGenerateQp.canSelectMany = false;
          fontToGenerateQp.onDidAccept(async () => {
            if (fontToGenerateQp.selectedItems.length) {
              resolve(fontToGenerateQp.selectedItems[0]);
            } else {
              reject('No font selected');
            }
            fontToGenerateQp.hide();
          });
          fontToGenerateQp.show();
        });
        // fspath from selected project
        oFontConfig = aFonts.find((oFontApp) => {
          return `${oFontApp.font.name} from ${oFontApp.ui5App.namespace}` == fontToGenerate.description;
        });
      } else if (aFonts.length == 1) {
        // only one project
        oFontConfig = aFonts[0];
      }
    } catch (e) {
      oFontConfig = undefined;
    }
    try {
      await this.generateFont(oFontConfig);
    } catch (oError) {
      Utils.logOutputFont(oError.message, 'ERROR');
      window.showErrorMessage(oError.message);
    }
  },

  async generateFont(oFontConfig) {
    let { font, ui5App } = oFontConfig;

    assert(!!font.type, `Property 'type' is mandatory`);
    assert(!!font.name, `Property 'name' is mandatory`);
    assert(!!font.outputDir, `Property 'outputDir' is mandatory`);

    let aDefaultAssetTypes = [OtherAssetType.HTML, OtherAssetType.CSS, OtherAssetType.JSON];
    font.assetTypes = font.assetTypes || aDefaultAssetTypes;
    assert(Array.isArray(font.assetTypes), `Property 'assetTypes' must be an array`);

    font.fontTypes = font.fontTypes || [FontAssetType.TTF, FontAssetType.EOT, FontAssetType.WOFF2, FontAssetType.WOFF];
    assert(Array.isArray(font.fontTypes), `Property 'fontTypes' must be an array`);

    let aExcluded = font.assetTypes.filter((sAsset) => {
      return !aDefaultAssetTypes.includes(sAsset);
    });
    assert(!aExcluded.length, `Property 'assetTypes' only accept ${aDefaultAssetTypes.toString()} values`);

    let sTemplatePath = path.resolve(Utils.getUi5ToolsPath(), 'static', 'templates');
    let oFontOptions = {
      inputDir: path.join(ui5App.appFsPath, font.inputDir || ''),
      outputDir: path.join(ui5App.appFsPath, font.outputDir, font.name),
      name: font.name,
      fontTypes: font.fontTypes,
      assetTypes: font.assetTypes,
      formatOptions: font.formatOptions || {},
      templates: {
        css: font.templates?.css || path.join(sTemplatePath, 'css.hbs'),
        html: font.templates?.html || path.join(sTemplatePath, 'html.hbs'),
      },
      // pathOptions: {},
      codepoints: font.codepoints || {},
      fontHeight: font.fontHeight || 300,
      round: font.round || 10e12,
      descent: font.descent || 0,
      normalize: font.normalize || false,
      selector: font.selector || '',
      tag: font.tag || 'i',
      prefix: font.prefix || 'icon',
      fontsUrl: font.fontsUrl || '',
    };

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: `ui5-tools > Generating font ${oFontOptions.name}`,
        cancellable: true,
      },
      async (progress, token) => {
        progress?.report({ increment: 10, message: `Cleaning destination folder...` });

        let outputUri = Uri.file(oFontOptions.outputDir);
        try {
          await workspace.fs.delete(outputUri, {
            recursive: true,
            useTrash: true,
          });
        } catch (oError) {}

        progress?.report({ increment: 10, message: `Creating destination folder...` });
        await workspace.fs.createDirectory(outputUri);

        progress?.report({ increment: 30, message: `Generating folder...` });
        await this.generate(oFontOptions, oFontConfig, progress);
      }
    );

    window.showInformationMessage(
      `Font ${oFontOptions.name} generated in project ${ui5App.folderName} at ${font.outputDir}`
    );
  },

  async generate(oFontOptions, oFontConfig, progress) {
    let { font } = oFontConfig;
    assert(['fantasticon', 'fontawesome'].includes(font.type), `Property 'type' (${font.type}) is not supported`);

    await this[font.type](oFontOptions, oFontConfig, progress);
  },

  generateAllFonts() {},

  async fantasticon(oFontOptions, oFontConfig, progress) {
    try {
      assert(!!oFontOptions.inputDir, `Property 'inputDir' is mandatory`);

      progress?.report({ increment: 30, message: `Generating font with fontasticon...` });
      let sIcons = await generateFonts(oFontOptions);

      progress?.report({ increment: 10, message: `Writing codepoints...` });
      // Transform int10 to string16
      let oCodePointsUri = Uri.file(path.join(oFontOptions.outputDir, `${oFontOptions.name}.json`));
      let oCodePointsBuffer = await workspace.fs.readFile(oCodePointsUri);
      let oCodePointsString = oCodePointsBuffer.toString();
      let oCodePoints = JSON.parse(oCodePointsString);
      let oNewCodePoints = {};
      for (let code in oCodePoints) {
        oNewCodePoints[code] = oCodePoints[code].toString(16);
      }
      let oNewCodePointsString = JSON.stringify(oNewCodePoints, null, 2);
      await workspace.fs.writeFile(oCodePointsUri, Buffer.from(oNewCodePointsString));
    } catch (oError) {
      console.error(oError);
    }
  },

  async fontawesome(oFontOptions, oFontConfig, progress) {
    let { font } = oFontConfig;
    assert(font.family, `Property 'family' [solid|regular|brands] is mandatory`);
    assert(['solid', 'regular', 'brands'].includes(font.family), `Property 'family' must match [solid|regular|brands]`);

    let oFileNames = {
      solid: 'fa-solid-900',
      regular: 'fa-regular-400',
      brands: 'fa-brands-400',
    };

    let sFileName = oFileNames[font.family];
    let sBaseUrl = 'https://raw.githubusercontent.com/FortAwesome/Font-Awesome/master/FOLDER/FILENAME.EXTENSION';

    progress?.report({ increment: 10, message: `Downloading fontawesome from github...` });
    let aRemotePromises = [];
    oFontOptions.fontTypes.forEach((sExtension) => {
      let sUrl = sBaseUrl.replace('FOLDER', 'webfonts').replace('FILENAME', sFileName).replace('EXTENSION', sExtension);

      aRemotePromises.push(this.getFile(sUrl));
    });

    let aFiles = await Promise.all(aRemotePromises);
    let aLocalPromises = [];

    progress?.report({ increment: 10, message: `Renaming font...` });
    oFontOptions.fontTypes.forEach((sExtension, i) => {
      let sPathFont = path.join(oFontOptions.outputDir, `${oFontOptions.name}.${sExtension}`);
      aLocalPromises.push(workspace.fs.writeFile(Uri.file(sPathFont), aFiles[i]));
    });

    progress?.report({ increment: 10, message: `Creating codepoints...` });
    let sCodePointsUrl = sBaseUrl
      .replace('FOLDER', 'metadata')
      .replace('FILENAME', 'icons')
      .replace('EXTENSION', 'json');
    let oCodePointsBuffer = await this.getFile(sCodePointsUrl);
    let sCodePoints = oCodePointsBuffer.toString();
    let oCodePointsRaw = JSON.parse(sCodePoints);
    let oCodePoints = {};
    oFontOptions.codepoints = {};
    oFontOptions.assets = {};
    for (let sIconCode in oCodePointsRaw) {
      let oIcon = oCodePointsRaw[sIconCode];
      if (oIcon.styles.indexOf(font.family) >= 0) {
        oCodePoints[sIconCode] = oIcon.unicode;
        oFontOptions.codepoints[sIconCode] = parseInt(oIcon.unicode, 16);
        oFontOptions.assets[sIconCode] = {
          id: sIconCode,
        };
      }
    }
    let sPathCodePoints = path.join(oFontOptions.outputDir, `${oFontOptions.name}.json`);
    let sNewCodepoints = JSON.stringify(oCodePoints, null, 2);
    await workspace.fs.writeFile(Uri.file(sPathCodePoints), Buffer.from(sNewCodepoints));

    progress?.report({ increment: 10, message: `Generating assets...` });
    this.generateAssets(oFontOptions, oFontConfig);
  },

  async generateAssets(oFontOptions, oFontConfig) {
    oFontOptions.assetTypes.forEach(async (sExtension) => {
      let sTemplatePath = oFontOptions.templates[sExtension];
      if (sTemplatePath) {
        let sTemplate;
        sTemplate = fs.readFileSync(sTemplatePath, { encoding: 'utf8' });

        try {
          let sFile = Handlebars.compile(sTemplate)(oFontOptions, {
            helpers: {
              fontSrc: this.renderSrcAttribute(oFontOptions),
              codepoint(codepoint) {
                return codepoint.toString(16);
              },
            },
          });
          let oCodePointsUri = Uri.file(path.join(oFontOptions.outputDir, `${oFontOptions.name}.${sExtension}`));
          workspace.fs.writeFile(oCodePointsUri, Buffer.from(sFile));
        } catch (oError) {
          debugger;
        }
      }
    });
  },

  renderSrcOptions: {
    [FontAssetType.EOT]: {
      formatValue: 'embedded-opentype',
      getSuffix: () => '#iefix',
    },
    [FontAssetType.WOFF2]: { formatValue: 'woff2' },
    [FontAssetType.WOFF]: { formatValue: 'woff' },
    [FontAssetType.TTF]: { formatValue: 'truetype' },
    [FontAssetType.SVG]: { formatValue: 'svg', getSuffix: (name) => `#${name}` },
  },

  renderSrcAttribute({ name, fontTypes, fontsUrl }) {
    return fontTypes
      .map((fontType) => {
        const { formatValue, getSuffix } = this.renderSrcOptions[fontType];
        const suffix = getSuffix ? getSuffix(name) : '';
        return `url("${fontsUrl || '.'}/${name}.${fontType}?${suffix}") format("${formatValue}")`;
      })
      .join(',\n');
  },

  async getFile(sUrl) {
    return new Promise((resolve, reject) => {
      let options = {
        timeout: 5000,
      };
      https
        .get(sUrl, options, (res) => {
          if (res.statusCode !== 200) {
            reject();
          } else {
            let aData = [];
            res.on('data', (chunk) => {
              aData.push(chunk);
            });
            res.on('end', () => {
              try {
                resolve(Buffer.concat(aData));
              } catch (e) {
                reject(e.message);
              }
            });
          }
        })
        .on('error', (e) => {
          reject(e);
        });
    });
  },
};
