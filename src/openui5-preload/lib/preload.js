// Copyright 2015 SAP SE.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http: //www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
// either express or implied. See the License for the specific
// language governing permissions and limitations under the License.

const fse = require('fs-extra');
const path = require('path');
const slash = require('slash');
const terser = require('terser');
const prettyData = require('pretty-data').pd;
const maxmin = require('maxmin');
const globby = require('globby');
const multimatch = require('multimatch');
const loggers = require('./loggers');
const lineCount = require('line-count');
const defaults = require('object.defaults');

const copyrightCommentsPattern = /copyright|\(c\)|released under|license|\u00a9/i;
const xmlHtmlPrePattern = /<(?:\w+:)?pre>/;

const defaultResourcePatterns = [
  '**/*.js',
  '**/*.fragment.html',
  '**/*.fragment.json',
  '**/*.fragment.xml',
  '**/*.view.html',
  '**/*.view.json',
  '**/*.view.xml',
  '**/*.properties',
];

const allPreloadTypes = ['libraries', 'components'];

const processContentJsCompat = (content) =>
  `jQuery.sap.registerPreloadedModules(` + JSON.stringify(content, null, '\t') + `);`;
const processContentJs = (content, name) =>
  `sap.ui.require.preload(` + JSON.stringify(content.modules, null, '\t') + `, "${name}");`;
const processContentJSON = (content) => JSON.stringify(content, null, '\t');

const preloadTypeInfoMap = {
  libraries_json: {
    // For UI5 1.38-
    moduleName: 'library-preload',
    indicatorFile: 'library.js',
    ext: '.json',
    processContent: processContentJSON,
    processModuleName: (moduleName) => moduleName.replace(/\//g, '.'),
  },
  libraries_legacy: {
    // For UI5 1.40+ - Legacy
    moduleName: 'library-preload',
    indicatorFile: 'library.js',
    ext: '.js',
    processContent: processContentJsCompat,
    processModuleName: (moduleName) => moduleName.replace(/\//g, '.'),
  },
  libraries_js: {
    // For UI5 1.54.1+
    moduleName: 'library-preload',
    indicatorFile: 'library.js',
    ext: '.js',
    processContent: processContentJs,
    processModuleName: (moduleName) => moduleName.replace(/\//g, '.'),
  },
  components_legacy: {
    // UI5 Legacy
    moduleName: 'Component-preload',
    ext: '.js',
    indicatorFile: 'Component.js',
    processContent: processContentJsCompat,
    processModuleName: (moduleName) => moduleName,
  },
  components_js: {
    // For UI5 1.51.1+
    moduleName: 'Component-preload',
    ext: '.js',
    indicatorFile: 'Component.js',
    processContent: processContentJs,
    processModuleName: (moduleName) => moduleName,
  },
};

function getPreloadTypeInfo(preloadType, options) {
  const { compatVersion } = options;
  let majorV = 0;
  let minorV = 0;
  const aVersionMatch = String(compatVersion).match(/^(\d+)\.(\d+)$/);
  if (aVersionMatch) {
    majorV = parseInt(aVersionMatch[1], 10);
    minorV = parseInt(aVersionMatch[2], 10);
  }

  if (preloadType === 'libraries') {
    if (compatVersion === 'edge' || (majorV === 1 && minorV >= 54) || majorV > 1) {
      preloadType = 'libraries_js';
    } else if (majorV === 1 && minorV >= 40 && minorV < 54) {
      preloadType = 'libraries_legacy';
    } else {
      preloadType = 'libraries_json';
    }
  } else {
    if (compatVersion === 'edge' || (majorV === 1 && minorV >= 54) || majorV > 1) {
      preloadType = 'components_js';
    } else {
      preloadType = 'components_legacy';
    }
  }
  return preloadTypeInfoMap[preloadType];
}

function preload(options = {}) {
  console.assert(options, "'options' is not specified!");

  loggers.verbose.setEnabled(options.verbose);

  defaults(options, {
    compress: true,
    override: true,
    compatVersion: 'json',
    comments: copyrightCommentsPattern,
    resources: [], // Will fail later, but with a better error
  });

  // Normalize resources
  if (!Array.isArray(options.resources)) {
    options.resources = [options.resources];
  }

  if (!options.resources.length) {
    throw new Error(`'resources' option is not specified!`);
  }

  const preloadTypes = allPreloadTypes.filter((preloadType) => options[preloadType]);

  if (!preloadTypes.length) {
    throw new Error(`No preload type specified. Provide one of '${allPreloadTypes.join(`', '`)}' in options!`);
  }

  const resourceMap = collectResources(options.resources);
  const resourceFiles = Object.keys(resourceMap);

  if (resourceFiles.length === 0) {
    throw new Error(`No files found. Check your "resources" option!`);
  }

  for (const preloadType of preloadTypes) {
    const preloadInfo = getPreloadTypeInfo(preloadType, options);

    let preloadOptions = options[preloadType];

    if (preloadOptions === true) {
      preloadOptions = {
        '**': {},
      };
    } else if (typeof preloadOptions === 'string') {
      preloadOptions = {
        [preloadOptions]: {},
      };
    }

    const preloadOptionKeys = Object.keys(preloadOptions);

    if (!preloadOptionKeys.length) {
      loggers.log.writeflags(preloadOptions, 'preloadOptions');
      throw new Error(`No valid options provided for '${preloadType}' preload!`);
    }

    for (const preloadPattern of preloadOptionKeys) {
      processPreloadPattern(preloadOptions, preloadInfo, preloadPattern);
    }
  }

  function processPreloadPattern(preloadOptions, preloadInfo, preloadPattern) {
    const preloadOption = preloadOptions[preloadPattern];
    const preloadFiles = multimatch(resourceFiles, path.join(preloadPattern, preloadInfo.indicatorFile));

    if (preloadFiles.length < 1) {
      throw new Error(`No '${preloadInfo.indicatorFile}' found for pattern '${preloadPattern}'`);
    }

    for (const preloadFile of preloadFiles) {
      generatePreloadFile(preloadOption, preloadInfo, preloadFile);
    }
  }

  function generatePreloadFile(preloadOption, preloadInfo, preloadFile) {
    const preloadDir = path.dirname(preloadFile);
    const preloadModuleName = `${preloadDir}/${preloadInfo.moduleName}`;
    const destPath = getDestPath(options, preloadInfo, preloadFile, preloadModuleName);
    const preloadObject = {
      version: '2.0',
      name: preloadInfo.processModuleName(preloadModuleName),
      modules: {},
    };

    if (options.override === false && fse.existsSync(destPath)) {
      loggers.verbose.subhead(`Preload for ${preloadFile} already exists and override=false`);
      return;
    }
    loggers.verbose.subhead(`Creating preload module for ${preloadFile}`);

    const preloadPatterns = [];
    if (Array.isArray(preloadOption.src)) {
      preloadPatterns.push(...preloadOption.src);
    } else if (preloadOption.src) {
      preloadPatterns.push(preloadOption.src);
    } else {
      preloadPatterns.push(`${preloadDir}/**`);
    }

    // To track total file size for logging
    let preloadOriginalSize = 0;
    let preloadCompressedSize = 0;

    const contentFiles = multimatch(resourceFiles, preloadPatterns);
    if (!contentFiles.length) {
      const patternsString = Array.isArray(preloadPatterns) ? preloadPatterns.join(`". "`) : preloadPatterns;
      throw new Error(`No files found for pattern(s): '${patternsString}'!`);
    }

    for (const file of contentFiles) {
      const [originalSize, compressedSize] = addContentFile(preloadObject, file);
      preloadOriginalSize += originalSize;
      preloadCompressedSize += compressedSize;
    }

    const processedContent = preloadInfo.processContent(preloadObject, preloadModuleName);
    fse.outputFileSync(destPath, processedContent);

    let log = `File ${destPath} created with ${Object.keys(preloadObject.modules).length} files`;
    if (preloadOriginalSize && preloadCompressedSize && preloadOriginalSize !== preloadCompressedSize) {
      const mm = maxmin({ length: preloadOriginalSize }, { length: preloadCompressedSize });
      log += ` (${mm})`;
    }
    loggers.log.writeln(log);
  }

  function getDestPath(options, preloadInfo, preloadFile, preloadModuleName) {
    let destPath = options.dest;
    const preloadResourceInfo = resourceMap[preloadFile];
    if (preloadModuleName.indexOf(preloadResourceInfo.prefix) === 0) {
      destPath = path.join(destPath, preloadModuleName.substr(preloadResourceInfo.prefix.length));
    } else {
      destPath = path.join(destPath, preloadModuleName);
    }
    destPath += preloadInfo.ext;
    return destPath;
  }

  function addContentFile(preloadObject, fileKey) {
    const fileName = resourceMap[fileKey].fullPath;
    let fileContent = fse.readFileSync(fileName, 'utf8');

    let originalSize, compressedSize, originalFileContent;

    if (options.compress) {
      originalSize = fileContent.length;
      originalFileContent = fileContent;

      if (lineCount(fileContent) > 1) {
        fileContent = minify(fileContent, fileName, options);
      }

      if (typeof fileContent === 'undefined' || fileContent === null) {
        if (!originalFileContent) {
          throw new Error(`No fileContent for ${fileName}`);
        } else {
          throw new Error(`Minification failed for ${fileName}`);
        }
      }
      compressedSize = fileContent.length;
    }

    if (options.verbose) {
      let log = `Adding ${fileKey}`;
      if (originalSize && compressedSize && originalSize !== compressedSize) {
        const mm = maxmin({ length: originalSize }, { length: compressedSize });
        log += ` (${mm})`;
      }
      loggers.verbose.writeln(log);
    }

    preloadObject.modules[fileKey] = fileContent;

    return [originalSize, compressedSize];
  }

  function minify(fileContent, fileName, options) {
    const fileExtension = path.extname(fileName);
    switch (fileExtension) {
      case '.js': {
        const result = terser.minify(fileContent, {
          warnings: options.verbose === true,
          output: {
            comments: options.comments,
          },
        });
        if (result.error) {
          loggers.log.writeln(`Error minifying ${fileName}: ${result.error}`);
          throw new Error(`Error minifying ${fileName}: ${result.error}`);
        }
        fileContent = result.code;
        break;
      }
      case '.json':
        // JSON is parsed and written to string again to remove unwanted white space
        fileContent = JSON.stringify(JSON.parse(fileContent));
        break;
      case '.xml':
        // Do not minify if XML(View) contains an <*:pre> tag because whitespace of HTML <pre>
        //  should be preserved (should only happen rarely)
        if (!xmlHtmlPrePattern.test(fileContent)) {
          fileContent = prettyData.xmlmin(fileContent, false);
        }
        break;
    }
    return fileContent;
  }
}

function collectResources(resources) {
  loggers.verbose.subhead('Collecting resources');
  const resourceMap = {};

  // Process resources array
  for (let resource of resources) {
    // Transform string shorthand to object
    if (typeof resource === 'string') {
      resource = {
        cwd: resource,
      };
    }

    if (typeof resource.prefix !== 'string') {
      resource.prefix = '';
    }

    resource.src = resource.src || defaultResourcePatterns;

    loggers.verbose.writeflags(resource, 'resource');

    const files = globby.sync(resource.src, {
      cwd: resource.cwd,
      dot: true,
      nodir: true,
    });

    for (const file of files) {
      const localFile = !resource.prefix ? file : slash(path.join(resource.prefix, file));
      const fullPath = path.join(resource.cwd, file);
      resourceMap[localFile] = {
        fullPath,
        prefix: resource.prefix,
      };
    }
  }
  return resourceMap;
}

module.exports = preload;
