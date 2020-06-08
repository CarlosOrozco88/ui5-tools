import { workspace, window, ConfigurationTarget, RelativePattern, ProgressLocation } from 'vscode';
import path from 'path';
import fs from 'fs';
import Utils from '../Utils/Utils';
import rimraf from 'rimraf';
import preload from 'openui5-preload';
import terser from 'terser';
import { pd as prettyData } from 'pretty-data';
import less from 'less';
const xmlHtmlPrePattern = /<(?:\w+:)?pre>/;

async function build(projectPath = undefined) {
  let config = Utils.loadConfig();
  if (!projectPath) {
    projectPath = await askProjectToBuild();
    if (projectPath === 'ALL') {
      return buildAllProjects();
    }
  }
  if (projectPath) {
    let { srcFolder, distFolder, debugSources, uglifySources } = config;
    if (!srcFolder || !distFolder || srcFolder == distFolder) {
      throw 'Invalid srcFolder or distFolder';
    }
    let appName = projectPath.split(path.sep).pop();
    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: `ui5-tools > Building app ${appName}`,
      },
      (progress, token) => {
        progress.report({ increment: 10 });

        return new Promise(function (resolv, reject) {
          let { compatVersion } = Utils.getOptionsVersion();
          // TODO: BUILD LESS
          progress.report({ increment: 0, message: `Building less` });
          compileLessSimple({
            fileName: path.join(projectPath, 'mockLess.less'),
          });

          // clean folder
          setTimeout(function () {
            progress.report({ increment: 20, message: `Cleaning folder` });
            rimraf.sync(path.join(projectPath, distFolder));

            setTimeout(function () {
              progress.report({ increment: 40, message: `Copying files` });
              copyRecursiveSync(
                path.join(projectPath, srcFolder),
                path.join(projectPath, distFolder),
                debugSources,
                uglifySources
              );

              setTimeout(function () {
                let library, cwd, dest, ns;
                setTimeout(function () {
                  progress.report({ increment: 60, message: `Reading manifest` });
                  let component = JSON.parse(
                    fs.readFileSync(path.join(projectPath, srcFolder, 'manifest.json'), 'utf-8')
                  );
                  let namespace = component['sap.app'].id;
                  library = component['sap.app'].type == 'library';

                  ns = namespace.split('.').join('/');
                  cwd = path.join(projectPath, srcFolder);
                  dest = path.join(projectPath, distFolder);

                  // preload
                  progress.report({ increment: 80, message: `Building preload` });
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

                  setTimeout(() => {
                    resolv();
                  }, 200);
                }, 200);
              }, 200);
            }, 200);
          }, 200);
        });
      }
    );
  }
}

async function askProjectToBuild() {
  let project = undefined;
  try {
    let { foldersWithName } = Utils.getConfig();
    let qpOptions = [];
    foldersWithName.forEach((folder) => {
      qpOptions.push({
        description: folder.uri.fsPath != folder.name ? path.sep + folder.uri.fsPath.split(path.sep).pop() : '',
        label: folder.name,
      });
    });
    if (qpOptions.length > 1) {
      if (qpOptions.length >= 2) {
        qpOptions.push({
          description: 'Build all UI5 projects',
          label: 'ALL',
        });
      }
      let ui5ProjectToBuild = await window.showQuickPick(qpOptions, {
        placeHolder: 'Select UI5 project to build',
        canPickMany: false,
      });
      if (ui5ProjectToBuild.label === 'ALL') {
        project = 'ALL';
      } else {
        project = foldersWithName.filter((folder) => {
          return folder.name == ui5ProjectToBuild.label;
        })[0].uri.fsPath;
      }
    } else if (qpOptions.length == 1) {
      project = qpOptions[0].uri.fsPath;
    }
  } catch (e) {
    project = undefined;
  }
  return project;
}

function copyRecursiveSync(src, dest, debugSources = true, uglifySources = true) {
  let existsSrc = fs.existsSync(src);
  let stats = existsSrc && fs.statSync(src);
  let isDirectory = existsSrc && stats.isDirectory();
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
          let minifiedFile = terser.minify(code);
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
        fs.writeFileSync(dest, prettyData.jsonmin(fs.readFileSync(src, 'utf8')));
        break;
      case '.xml':
        let xml = fs.readFileSync(src, 'utf8');
        if (!xmlHtmlPrePattern.test(xml)) {
          xml = prettyData.xmlmin(xml, false);
        }
        fs.writeFileSync(dest, xml);
        break;
      case '.less':
        // do not copy
        break;
      default:
        fs.copyFileSync(src, dest);
        break;
    }
  }
}

async function compileLessAuto({ fileName }, autoBuild = true) {
  if (path.extname(fileName) === '.less') {
    let { foldersWithName, buildLess } = Utils.loadConfig();
    if (autoBuild && !buildLess) {
      // Do not build if autoBuild is disabled
      return;
    }
    // Do compile
    let cPath;
    let appPath = foldersWithName.find((folder) => {
      cPath = `${folder.uri.fsPath}${path.sep}`;
      return fileName.indexOf(cPath) === 0;
    });
    if (appPath) {
      let folder = appPath.uri.fsPath.split(path.sep).pop();
      let pattern = new RelativePattern(appPath, `**/{styles,${folder}}.less`);
      let lessFiles = await workspace.findFiles(pattern);

      await window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: 'ui5-tools > Building css files',
        },
        (progress, token) => {
          progress.report({ increment: 10 });

          lessFiles.forEach((lessFile) => {
            setTimeout(function () {
              progress.report({ increment: 10 + 90 / lessFiles.length, message: `${folder}.css` });
              less
                .render(fs.readFileSync(lessFile.fsPath, 'utf-8'), {
                  filename: lessFile.fsPath,
                })
                .then(
                  function (output) {
                    fs.writeFileSync(lessFile.fsPath.replace('.less', '.css'), prettyData.cssmin(output.css));
                  },
                  function (error) {
                    console.error(error);
                    throw new Error(error);
                  }
                );
            }, 100);
          });
          return new Promise((resolve) => {
            setTimeout(function () {
              resolve();
            }, lessFiles.length * 100 + 50);
          });
        }
      );
    }
  }
}

async function compileLessSimple({ fileName }) {
  if (path.extname(fileName) === '.less') {
    let { foldersWithName } = Utils.loadConfig();
    // Do compile
    let cPath;
    let appPath = foldersWithName.find((folder) => {
      cPath = `${folder.uri.fsPath}${path.sep}`;
      return fileName.indexOf(cPath) === 0;
    });
    if (appPath) {
      let folder = appPath.uri.fsPath.split(path.sep).pop();
      let pattern = new RelativePattern(appPath, `**/{styles,${folder}}.less`);
      let lessFiles = await workspace.findFiles(pattern);

      lessFiles.forEach((lessFile) => {
        less
          .render(fs.readFileSync(lessFile.fsPath, 'utf-8'), {
            filename: lessFile.fsPath,
          })
          .then(
            function (output) {
              fs.writeFileSync(lessFile.fsPath.replace('.less', '.css'), prettyData.cssmin(output.css));
            },
            function (error) {
              console.error(error);
              throw new Error(error);
            }
          );
      });
    }
  }
}

async function buildAllProjects() {
  let { foldersWithName } = Utils.getConfig();
  for (let id in foldersWithName) {
    await build(foldersWithName[id].uri.fsPath);
  }
  return;
}

export default {
  build,
  compileLessAuto,
};
