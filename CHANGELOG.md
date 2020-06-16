## 0.2.1 (15-06-2020)

- SSL proxy verification default to false
- Replace strings in builder
- New configurator command: replace strings
- Auto theme less builder
- Bug/resource cache solved while restarting server (.env, manifest.json)
- New keymaps support
- Major refactor
- Implemented port finder

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
