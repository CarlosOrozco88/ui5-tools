<p align="center">
<img src="static/images/logo_blue.png" width="100" />
<h1 align="center">ui5-tools Extension</h1>
</p>

VSCode extension for ui5 developers. This extension is not intended to replace ui5 cli, its main objective is to provide a fast and global workspace configuration to work with multi root workspaces and projects deployed to on premise systems (Gateway).

## Examples

> You can find examples of vscode workspace configuration in [this repository](https://github.com/CarlosOrozco88/ui5-tools-examples).

## Features

---

### ui5-tools

- **Automatic less builder**. Looks for `styles.less` and `PROJECTFOLDER.less`
- **Automatic themes builder**. Build `library.source.less` themes
- **Configurator** commands for odata proxy, resources proxy and replace strings

#### Server

- **Handles AppCachebuster** in localhost (by default only in PROD mode).
- Configurable **proxy** to one o multiple **odata service** (Gateway, Other, None). Command `alt+c alt+o`
- Supports `.env` file for odata service authentication. Example of `.env` file:

```json
UI5TOOLS_ODATA_USER=
UI5TOOLS_ODATA_PASSWORD=
UI5TOOLS_ODATA_USER_2=
UI5TOOLS_ODATA_PASSWORD_2=
UI5TOOLS_ODATA_USER_N=
UI5TOOLS_ODATA_PASSWORD_N=
```

- Configurable **proxy** to **resources** (Gateway, CDN SAPUI5, CDN OpenUI5, Local Runtime, None). Command `alt+c alt+u`
- Configurable UI5 version (when using gateway proxy, extension will detect sapui5 version automatically)
- **Live reload browser**, css and images hot reload
- **Typescript** support (ESM)
- **Built in localhost home** page server, with apps launchpad, readme.md, docs (md files), links, server info...
- **Built in launchpad** for resources: Gateway, CDN SAPUI5 and Runtime. Configurable with file `fioriSandboxConfig.json`
- Server uses **folder hierarchy**. For product apps and Z apps, is possible to emulate gateway bsp paths
- Start server in **development mode** `alt+s alt+s` or **production mode** `alt+s alt+p` (launches `appFolder/libraryFolder` or `distFolder` folder of each project)
- Multiple comands: start `alt+s alt+s`, restart `alt+s alt+r`... (check commands secction)

#### Builder

- **Component-preload.js**, checking configured ui5 version for correct build. Build your project by doing right click in project folder or `alt+b alt+b` and select project
- **Dbg** files creation
- **Typescript** support (ESM)
- **Build less** files (looks for `styles.css`, `PROJECTFOLDERNAME.less` or library.source.less)
- **Uglify** files
- **Replace strings**
- Build one project `alt+b alt+b` or all apps `alt+b alt+a` in one command
- Building preload (Component-preload and library-preload) process uses [openui5-preload](https://github.com/r-murphy/openui5-preload)
- Building theme (library.source.less) process uses [less-openui5](https://github.com/SAP/less-openui5)
- Building styles (styles.less and PROJECTFOLDER.less) process uses [less](https://github.com/less/less.js)

#### Deployer

- **Gateway deploy**, process includes build process. Deploy your project doing right click in project folder or `alt+d alt+d` and select project
- **ui5-tools.json** file located at project folder, with deployment configuration: [ui5-tools.json example](workspaceExample/Z_APP1/ui5-tools.json)
- **Create, update and save** last order in ui5-tools.json file (configurable)
- **Autoprefix** BSP name in order text while creation (optional)
- Supports `.env` file for gateway authentication.

```json
UI5TOOLS_DEPLOY_USER=
UI5TOOLS_DEPLOY_PASSWORD=
```

- Deploy process uses [ui5-nwabap-deployer-core
  ](https://github.com/pfefferf/ui5-nwabap-deployer/blob/master/packages/ui5-nwabap-deployer-core), so the extension uses the same configuration in file ui5-tools.json (property deployer.options)

#### Importer

- **Import BSP** directly from Gateway systems `alt+i alt+i`
- Supports `.env` file for gateway authentication.

```json
UI5TOOLS_IMPORT_USER=
UI5TOOLS_IMPORT_PASSWORD=
```

### String replacer

- **Default replace patterns** `<% TIMESTAMP %>`, `<% ISODATE %>`, `<% DMY %>`, `<% YMD %>`, `<% MYD %>`
- **Create custom replacements** like `<% CUSTOMKEY %>` in workspace environment (configurable with command `alt+c alt+r`)
- **Computed values** `COMPUTED_DATE_TIMESTAMP`, `COMPUTED_DATE_ISO`, `COMPUTED_DATE_DMY`, `COMPUTED_DATE_YMD`, `COMPUTED_DATE_MYD` and the special value `COMPUTED_DATE_FORMATTED`
- **Suports custom computed date format**, replacements using dayjs during the build process:

```json
"ui5-tools.builder.replaceKeysValues": [
  {
    "key": "DATE_FORMATED_EXAMPLE",
    "value": "COMPUTED_DATE_FORMAT",
    "param": "DD/MM/YYYY HH:mm:SS"
  }
]
```

## Settings

---

#### General Settings

- `ui5-tools.appSrcFolder`: Source folder for applications (ts) | default: `src`
- `ui5-tools.appFolder`: Transpiled folder for applications (js) | default: `webapp`
- `ui5-tools.librarySrcFolder`: Source folder for libraries (ts) | default: `src`
- `ui5-tools.libraryFolder`: Transpiled folder for libraries (js) | default: `src-gen`
- `ui5-tools.distFolder`: Destination folder in your project (final build) | default: `dist`
- `ui5-tools.ui5Version`: UI5 library version for CDN proxy in server and build correct preload files: `1.71.42`
- `ui5-tools.verbose`: Log al messages `false`

#### Server Settings

- `ui5-tools.server.name`: Server name | default: `UI5 Server`
- `ui5-tools.server.port`: Set custom port of UI5 Server | default: `3000`
- `ui5-tools.server.startOnLaunch`: Start server at launch vscode | default: `false`
- `ui5-tools.server.openBrowser`: Open browser al launch server | default: `true`
- `ui5-tools.server.watch`: Activate live reload | default: `true`
- `ui5-tools.server.timeout`: Server timeout (ms), 0 for disable timeout | default: `60000`
- `ui5-tools.server.watchExtensions`: Extensions to listen for live reload | default: `css,js,json,xml,html,properties`
- `ui5-tools.server.protocol`: Should use http or https | default: `http`
- `ui5-tools.server.odataProxy`: Proxy all odata calls to a server | default: `None`
- `ui5-tools.server.odataUri`: Your odata server uri url (example: `http://srvaspgwd.com:8080/`). odataProxy `Other` accepts multiple uris (example: `http://srvaspgwd.com:8080/, http://srvaspgwd.com:8080/`)
- `ui5-tools.server.odataSecure`: Verify odataProxy SSL Certs | default: `false`
- `ui5-tools.server.odataMountPath`: The mountpath for 'Other' odataProxy. Accepts multiple paths, respecting the same order that odataUri for odataProxy type `Other` | default: `/odata`
- `ui5-tools.server.resourcesProxy`: Proxy all odata calls to a Gateway, CDN or Local Runtime (proxy all url begining with /resources) | default: `CDN SAPUI5`
- `ui5-tools.server.resourcesUri`: Your resources server url (example: http://srvaspgwd.com:8080/)
- `ui5-tools.server.proxyDestinations`: Your own list of destinations | default: `[]`
- `ui5-tools.server.resourcesSecure`: Verify resourcesProxy SSL Certs | default: `false`
- `ui5-tools.server.babelSourcesLive`: Live transform es6 to es5 (server in DEV mode), internet explorer 11 compat: `false`
- `ui5-tools.server.cacheBuster`: Activate cacheBuster in server mode: | Default: `None`

#### Builder Settings

- `ui5-tools.builder.babelSources`: Transform es6 to es5, internet explorer 11 compat | default: `false`
- `ui5-tools.builder.babelSourcesExclude`: Exclude uri for babel, generate a RelativePattern to exclude, can be n separated by comma | default: ``
- `ui5-tools.builder.debugSources`: Create debug js files when building | default: `true`
- `ui5-tools.builder.uglifyPreload`: Uglify Component-preload.js when building. If uglifySources is activated, this flag is redundant | default: `false`
- `ui5-tools.builder.uglifySources`: Uglify Component-preload.js and all js files when building | default: `true`
- `ui5-tools.builder.uglifySourcesExclude`: Exclude uri for uglify, generate a RelativePattern to exclude, can be n separated by comma | default: ``
- `ui5-tools.builder.preloadSrc`: Array with all patterns to include/exclude in Component-preload.js | default: `"**/*.js", "**/*.fragment.html", "**/*.fragment.json", "**/*.fragment.xml", "**/*.view.html", "**/*.view.json", "**/*.view.xml", "**/*.properties", "!**/*-dbg.js"`
- `ui5-tools.builder.buildLess`: Auto build less files into css when saving changes | default: `true`
- `ui5-tools.builder.replaceStrings`: Replace strings when building | default: `true`
- `ui5-tools.builder.replaceExtensions`: File extensions to look for keys to replace | default: `xml,js,json,properties`
- `ui5-tools.builder.replaceKeysValues`: Key/Value pair list. Replace <% key %> with 'value' while building the project | default:
  `[ { "key": "TIMESTAMP", "value": "COMPUTED_DATE_TIMESTAMP" }, { "key": "ISODATE", "value": "COMPUTED_DATE_ISO" }, { "key": "DMY", "value": "COMPUTED_DATE_DMY" }, { "key": "YMD", "value": "COMPUTED_DATE_YMD" }, { "key": "MYD", "value": "COMPUTED_DATE_MYD" } ]`

#### Deployer Settings

- `ui5-tools.deployer.autoSaveOrder`: Saves de transport number in ui5-tools.json file | default: `true`
- `ui5-tools.deployer.autoPrefixBSP`: Auto prefix BSP name in all transport texts while creation | default: `false`
- `ui5-tools.deployer.rejectUnauthorized`: Reject deployments in servers with misconfigured certificates

#### Importer Settings

- `ui5-tools.importer.uri`: Source gateway system to import BSPs | default: ``

## Commands

---

#### General Commands

- `ui5-tools.general.refreshProjects`: Search for UI5 projects | Shortcut: `alt+g alt+r`
- `ui5-tools.general.showOutput`: Open the extension output | Shortcut: `alt+g alt+o`

#### Server Commands

- `ui5-tools.server.startDevelopment`: Start server in development mode (appFolder/libraryFolder) | Shortcut: `alt+s alt+s`
- `ui5-tools.server.startProduction`: Start server in production mode (distFolder) | Shortcut: `alt+s alt+p`
- `ui5-tools.server.startBuildProduction`: Build workspace and start server in production mode | Shortcut: `alt+s alt+b`
- `ui5-tools.server.stop`: Stop server | Shortcut: `alt+s alt+x`
- `ui5-tools.server.restart`: Restart server | Shortcut: `alt+s alt+r`
- `ui5-tools.server.toggle`: Toggle server | Shortcut: `alt+s alt+t`

#### Builder Commands

- `ui5-tools.builder.build`: Build ui5 project | Shortcut: `alt+b alt+b`
- `ui5-tools.builder.buildAll`: Build workspace | Shortcut: `alt+b alt+a`
- `ui5-tools.builder.generate`: Generate ui5 project: `alt+b alt+g`

#### Deployer Commands

- `ui5-tools.deployer.deploy`: Build and deploy project | Shortcut: `alt+d alt+d`
- `ui5-tools.deployer.deployOnly`: Deploy project | Shortcut: `alt+d alt+o`
- `ui5-tools.deployer.deployMultiple`: Build and deploy multiple projects | Shortcut: `alt+m alt+m`

#### Importer Commands

- `ui5-tools.importer.import`: Import BSP from Gateway system | Shortcut: `alt+i alt+i`

#### Configurator Commands

- `ui5-tools.configurator.odataProvider`: Configure odata provider | Shortcut: `alt+c alt+o`
- `ui5-tools.configurator.ui5Provider`: Configure ui5 provider | Shortcut: `alt+c alt+u`
- `ui5-tools.configurator.replaceStrings`: Configure replace strings | Shortcut: `alt+c alt+r`
- `ui5-tools.configurator.uninstallRuntime`: Uninstall SAPUI5 Runtime | Shortcut: `alt+c alt+d`

## Menus

---

- `ui5-tools.menu.builder.build`: Build option in project folder menu (right click)
- `ui5-tools.menu.builder.generate`: Generate the project from `appSrcFolder/librarySrcFolder` to `appFolder/libraryFolder` (right click)
- `ui5-tools.menu.deployer.deploy`: Build and deploy option in project folder menu (right click)
- `ui5-tools.menu.deployer.deployOnly`: Deploy option in project folder menu (right click)

## Credits

---

- Preload javascript builder: [openui5-preload](https://github.com/r-murphy/openui5-preload) - [Ryan Murphy](https://github.com/r-murphy)
- Deployer: [ui5-nwabap-deployer-core](https://github.com/pfefferf/ui5-nwabap-deployer/blob/master/packages/ui5-nwabap-deployer-core) - [Florian Pfeffer](https://github.com/pfefferf)
- Less library builder: [less-openui5](https://github.com/SAP/less-openui5) - [SAP](https://github.com/SAP)
