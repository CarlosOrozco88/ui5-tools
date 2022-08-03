## 2.0.4 (03/08/2022)

- Fixed MS Windows watcher fsPaths
- Fixed replace strings in ts files
- Dependencies upgrade

## 2.0.3 (29/07/2022)

- Some ui5 projects discovery performance improvements
- Fixed deploy with `Project Folder`

## 2.0.2 (28/07/2022)

- Command `ui5-tools.deployer.deployAll` replaced by `ui5-tools.deployer.deployMultiple`
- Now generate at server launch only generates projects that have different `appFolder/libraryFolder` and `appSrcFolder/librarySrcFolder`

## 2.0.1 (25/07/2022)

- Added more sandbox.js files for newer sapui5 versions | Launchpad
- Fixed fioriSandboxConfig issues | Launchpad
- Status bar bugs fixed
- Hot reload bugs fixed
- Changed urls to CDN: [more info here](https://blogs.sap.com/2022/07/20/short-and-powerful-convenient-urls-for-sapui5-openui5-cdn/)
- Dependencies upgrade

## 2.0.0 (22/07/2022)

- Full Typescript support
- Deprecated configuration property `ui5-tools.srcFolder`. Splitted in two configuration properties:
- New configuration properties `ui5-tools.appFolder` and `ui5-tools.libraryFolder`. The actual folder of normal ui5 apps writed in javascript (same as old configuration property `ui5-tools.srcFolder`, but with defaults to `webapp/src-gen`)
- New configuration properties `ui5-tools.appSrcFolder` and `ui5-tools.librarySrcFolder` (defaults `src/src`). The new working folder for typescript projects. It will be transpiled into `appFolder/libraryFolder` at server launch.
- New command `ui5-tools.general.refreshProjects` (`alt+g alt+r`). Search for UI5 projects.
- New command `ui5-tools.builder.generate` (`alt+b alt+g`). Generate `appFolder/libraryFolder` from a project
- Show output keybinding changed to `alt+g alt+o`
- New option in the project menu: `Generate UI5 Project`
- Removed apicache / server side resources cache
- New repo with [workspace examples](https://github.com/CarlosOrozco88/ui5-tools-examples)
- Changed default `ui5-tools.server.resourcesProxy` from `Runtime` to `OpenUI5`
- Updated default `ui5-tools.ui5Version` from 1.71.42 to 1.71.46
- Dependencies upgrade

## 1.2.0 (21/06/2022)

- New! First typescript (ESM) support, both server and builder
- Dependencies upgrade

## 1.1.20 (17/06/2022)

- Upgraded default `ui5-tools.ui5Version` from `1.71.44` to `1.71.48`
- New configuration property `ui5-tools.server.proxyDestinations`
- Dependencies upgrade

## 1.1.18 & 1.1.19 (08/06/2022)

- New Configurator menu: `Configurator --> Uninstall SAPUI5 Runtime` (shortcut `alt+c alt+d`)
- Dependencies upgrade

## 1.1.17 (29/03/2022)

- Dependencies upgrade

## 1.1.16 (09/02/2022)

- Fixed: css hot reload
- Dependencies upgrade

## 1.1.12-15 (20/01/2022)

- Changed runtime download from `~/.vscode/extensions/carlosorozcojimenez.ui5-tools-support/runtime/` to file system path provide by VSCode. Now using `globalStorageUri` from `ExtensionContext`.
- Improved livereload and manifest CRUD detection
- Dependencies upgrade
- Hotfixes

## 1.1.11 (12/01/2022)

- Fixed: autorefresh
- Dependencies upgrade

## 1.1.10 (11/01/2022)

- Fixed: configuration property `ui5-tools.deployer.rejectUnauthorized` / SSL certs error when deploying

## 1.1.9 (10/01/2022)

- Fixed: autorefresh when `distFolder === srcFolder`
- Fixed: showing EULA when downloading SAPUI5 Runtime

## 1.1.8 (09/01/2022)

- Changed runtime download from `~/.vscode/extensions/carlosorozcojimenez.ui5-tools-${version}/runtime/` to `~/.vscode/extensions/carlosorozcojimenez.ui5-tools-support/runtime/`

## 1.1.7 (09/01/2022)

- Updated default value for `ui5-tools.ui5Version` to 1.71.44
- Updated default value for `ui5-tools.server.resourcesProxy` to `Runtime`
- File `sandbox.js` is included in the extension bundle. Now it is possible to launch the launchpad in enclosed networks
- Dependencies upgrade

## 1.1.6 (04/01/2022)

- New `ui5-tools.server.resourcesProxy` option `Runtime`. Download from tools.hana.ondemand.com the Runtime selected. The runtime is downloaded and unzipped in ui5-tools/runtime extension folder.
- Wizard for `Configurator -> Ui5Provider` updated with `Runtime` options
- Server start: when using new `Runtime` option, server startup checks if ui5 version is downloaded and download it automatically.
- Dependencies upgrade

## 1.1.5 (18/11/2021)

- Dependencies upgrade

## 1.1.4 (03/11/2021)

- Fixed: detection of projects without webapp/src/Webcontent folders and deployment without build
- Dependencies upgrade

## 1.1.3 (29/10/2021)

- Fixed: `ui5-tools.server.babelSourcesLive` fixed in windows systems
- Changed: computed date replaced changed due to speed improvements. Check [readme file](README.md)
- Dependencies upgrade

## 1.1.2 (22/10/2021)

- New configuration property `ui5-tools.server.babelSourcesLive`. Live transpile js.
- AppcacheBuster is changed default value: `None`.

## 1.1.1 (19/10/2021)

- Babelify bug solved
- Dependencies upgrade

## 1.1.0 (18/10/2021)

- Extension migrated to typescript
- Removed font generator: check new extension [Icon Font Bundler](https://marketplace.visualstudio.com/items?itemName=carlosorozcojimenez.icon-font-bundler)
- Some bugs solved
- Updated default UI5 to version from 1.71.35 to 1.71.42

## 1.0.4 (28-07-2021)

- Delete dist folder bug solved

## 1.0.3 (28-07-2021)

- Chokidar bug solved

## 1.0.2 (27-07-2021)

- Deploy bug solved
- Log extracted in a single file
- Refactoring

## 1.0.1 (26-07-2021)

- AppcacheBuster is now enabled by default in PROD mode only, new configuration property `ui5-tools.server.cacheBuster`
- Restored no-cache flag for resources proxy

## 1.0.0 (23-07-2021)

- Dependencies upgrade
- AppCachebuster simulator in localhost server with timestamps for every file served. Timestamp from
  last modification/creaton of every file.
- It is now possible to debug with F12 without `Disable cache` option checked in `Network` tab if you are using AppCacheBuster.
- Other improvements, server index, extension messages, builder code, live server/live builder, live server production...
- Server index changes: Sponsors section, About and Changelog section, modified Info section

## 0.6.13 (20-07-2021)

- Dependencies upgrade
- Markdown docs improvements

## 0.6.12 (06-07-2021)

- Dependencies upgrade
- Async preload creation thanks to [openui5-preload](https://github.com/r-murphy/openui5-preload) - [Ryan Murphy](https://github.com/r-murphy)

## 0.6.11 (05-07-2021)

- Dependencies upgrade
- Readme bug solved
- New option `ui5-tools.deployer.rejectUnauthorized`

## 0.6.10 (04-06-2021)

- Library preload bundle bug solved

## 0.6.9 (04-06-2021)

- Dependencies upgrade
- New deploy commands `ui5-tools.deployer.deployAll`
- New comands: `ui5-tools.fonts.generate` and `ui5-tools.fonts.generateAll`. Compatible with a folder containing svg files and importing font awesome from github
- New option: `ui5-tools.builder.babelSourcesExclude`
- Look for all \*.md files in workspace to show in `localhost/ui5tools/#/docs` route
- Can build app without Component.js

## 0.6.8 (26-04-2021)

- New options: `ui5-tools.builder.buildPreload` and `ui5-tools.deployer.deployFolder`
- Dependencies upgrade
- Corrected bugs

## 0.6.4 to 0.6.7 (19-03-2021 / 23-03-2021)

- Windows systems build/menu bug solved

## 0.6.3 (18-03-2021)

- Livereload bug solved

## 0.6.2 (17-03-2021)

- Output ui5-tools extension log: bug corrected
- Updated default UI5 to version from 1.71.20 to 1.71.35

## 0.6.1 (17-03-2021)

- Readme updated
- Credits section updated
- .env file changes does not require restart vscode or extension now

## 0.6.0 (16-03-2021)

- New deployer! Gateway deployments
- Right click in project folder in order to build or deploy ui5 project
- Strings replaced updated with new format options (Date)
- readme: updated credits section

## 0.5.0 (18-02-2021)

- New builder options: `ui5-tools.builder.uglifyPreload`, `ui5-tools.builder.uglifySourcesExclude`, `ui5-tools.builder.preloadSrc`
- readme: +credits section
- Upgrade dependencies

## 0.4.8 (13-02-2021)

- Upgrade dependencies

## 0.4.7 (01-02-2021)

- Upgrade dependencies
- Corrected manifest.json discover function

## 0.4.6 (14-12-2020)

- Server startup vars changed
- New <% ISODATE %> key (Replacestrings)
- Upgrade dependencies version

## 0.4.3 (19-11-2020)

- Server autostart bug solved
- Gateway version fetching bug solved

## 0.4.2 (15-11-2020)

- New options `ui5-tools.server.odataSecure` and `ui5-tools.server.resourcesSecure`
- Updated dependencies
- New output container ui5-tools. All relevant messages are printed there

## 0.4.1 (06-11-2020)

- Builder: now it is possible to auto-build themes (library.source.less) and styles (styles.less/projectNameFolder.less) on library and components both.
- Configurator: auto detects ui5 version for gateway proxy (ui5 provider)
- Server: now can serve root folder by setting `srcFolder` = '', if build folder is equal to `srcFolder`', Builder only generates css and Component-preload.
- Updated default UI5 to version from 1.71.20 to 1.71.27
- Corrected resources server cache
- Infinite starting server bug solved related to manifest.json errors

## 0.4.0 (03-08-2020)

- Babelify files for ie11 compatibility (only for builder)
- Configurable server timeout (default: 60000ms)

## 0.3.1 (18-06-2020)

- Livereload bug solved

## 0.3.0 (17-06-2020)

- SSL proxy verification default to false
- Replace strings in builder
- New configurator command: replace strings
- Auto theme less builder
- Bug/resource cache solved while restarting server (.env, manifest.json)
- New keymaps support
- Major refactor
- Implemented port finder
- PDF corrupted error solved

## 0.2.0 (09-06-2020)

- Authentication with `.env` file for Other proxies
- Less autobuild to css
- Breaking changes! new option `resourcesUri` to separate from `odataUri` for gateway users

## 0.1.8 (03-06-2020)

- Multiple odataUri and odataMountPath for `Other` odataProxy
- Bug correction in `Other` odataProxy
- Example in `workspaceExample` width multiple `Other` odataUri/odataMountPath pointing to northwind

## 0.1.7 (03-06-2020)

- Added "Other" destination to odataProxy and odataMountPath
- MD files bugs solved (docs folder)
- Default UI5 proxy switched from OpenUI5 to SAPUI5
- Autorestart server after changing configuration

## 0.1.6 (29-05-2020)

- Breaking changes! options gatewayProxy/gatewayUri -> odataProxy/odataUri

## 0.1.5 (29-05-2020)

- New server index + readme + docs + links + info

## 0.1.4 (28-05-2020)

- Fix? vscode endless loop instalation

## 0.1.3 (28-05-2020)

- Bug correction for windows users

## 0.1.2 (28-05-2020)

- Server: launchpad file sandbox.js fetched from sapui5 cdn
- Server: bug correction for cache cleaning at startup
- Server: url launchpad added last slash /flp/

## 0.1.1 (27-05-2020)

- Server: launchpad theme for older versions

## 0.1.0 (27-05-2020)

- Server: new sandbox launchpad for sapui5 framework. Customizable with firiSandboxConfig.json in workspaceroot
- Server: new server index with ui5, includes readme.md and docs folders (\*.md). When SAPUI5 framework, shows link to the sandbox launchpad
- Server: new server-side caching for resources, cache cleaning at server startup
- Server: proxy for gateway asks user for username and password before server initialization
- Configurator: now you can select ui5 versions fetched from CDN, manual option is fallback

## 0.0.5 (23-05-2020)

- Server: correction for windows users

## 0.0.4 (20-05-2020)

- Server: auto-serve index with workspace apps

## 0.0.2 to 0.0.3 (19-05-2020)

- Webpack bundle: livereload correction bug

## 0.0.1 (18-05-2020)

- Initial version of the ui5-tools extension with server and builder
