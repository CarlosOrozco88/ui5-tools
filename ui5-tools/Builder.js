const { workspace, window, ConfigurationTarget } = require('vscode');
const path = require('path');
const fs = require('fs');
const Utils = require('./Utils');
const rimraf = require('rimraf');
const preload = require('openui5-preload');
const UglifyJS = require('uglify-js');

async function build(projectPath = undefined) {
  if (!projectPath) {
    projectPath = await askProjectToBuild();
  }
  if (projectPath) {
    let { srcFolder, distFolder, ui5Version, debugSources, uglifySources } = Utils.loadConfig();
    if (!srcFolder || !distFolder || srcFolder == distFolder) {
      throw 'Invalid srcFolder or distFolder';
    }
    let compatVersionArr = ui5Version.split('.');
    while (compatVersionArr.length > 2) {
      compatVersionArr.pop();
    }
    let compatVersion = compatVersionArr.join('.');

    // clean folder
    rimraf.sync(path.join(projectPath, distFolder));

    copyRecursiveSync(
      path.join(projectPath, srcFolder),
      path.join(projectPath, distFolder),
      debugSources,
      uglifySources
    );

    let component = require(path.join(projectPath, srcFolder, 'manifest.json'));
    let namespace = component['sap.app'].id;
    let library = component['sap.app'].type == 'library';

    let ns = namespace.split('.').join('/');
    let cwd = path.join(projectPath, srcFolder);
    let dest = path.join(projectPath, distFolder);
    // preload
    preload({
      resources: {
        cwd,
        prefix: ns,
      },
      dest,
      compatVersion: compatVersion,
      compress: true,
      verbose: false,
      components: !library ? ns : false,
      libraries: library ? ns : false,
    });
  }
}

async function askProjectToBuild() {
  let project = undefined;
  try {
    let { foldersWithName } = Utils.loadConfig();
    let qpOptions = [];
    foldersWithName.forEach((folder) => {
      qpOptions.push({
        description: folder.uri.path != folder.name ? path.sep + folder.uri.path.split(path.sep).pop() : '',
        label: folder.name,
      });
    });
    if (qpOptions.length > 1) {
      let ui5ProjectToBuild = await window.showQuickPick(qpOptions, {
        placeHolder: 'Select UI5 project to build',
        canPickMany: false,
      });
      project = foldersWithName.filter((folder) => {
        return folder.name == ui5ProjectToBuild.label;
      })[0].uri.path;
    } else if (qpOptions.length == 1) {
      project = qpOptions[0].uri.path;
    }
  } catch (e) {
    project = undefined;
  }
  return project;
}

function copyRecursiveSync(src, dest, debugSources = true, uglifySources = true) {
  var existsSrc = fs.existsSync(src);
  var stats = existsSrc && fs.statSync(src);
  var isDirectory = existsSrc && stats.isDirectory();
  if (isDirectory) {
    fs.mkdirSync(dest);
    fs.readdirSync(src).forEach(function (childItemName) {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName), debugSources, uglifySources);
    });
  } else {
    switch (path.extname(src)) {
      case '.js':
        let copyOriginal = true;
        if (uglifySources) {
          let code = fs.readFileSync(src, 'utf8');
          let minifiedFile = UglifyJS.minify(code);
          if (!minifiedFile.error) {
            copyOriginal = false;
            fs.writeFileSync(dest, minifiedFile.code);
          }
        }
        if (copyOriginal) {
          fs.copyFileSync(src, dest);
        }

        if (debugSources) {
          fs.copyFileSync(src, dest.replace('.js', '-dbg.js'));
        }
        break;
      case '.json':
        let json = fs.readFileSync(src, 'utf8');
        let jsonStringified = JSON.stringify(JSON.parse(json));
        fs.writeFileSync(dest, jsonStringified);
        break;
      default:
        fs.copyFileSync(src, dest);
        break;
    }
  }
}

module.exports = {
  build,
};
