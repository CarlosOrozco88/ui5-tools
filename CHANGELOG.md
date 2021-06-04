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
