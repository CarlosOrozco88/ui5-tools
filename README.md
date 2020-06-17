<p align="center">
<img src="static/images/logo_blue.png" width="100" />
<h1 align="center">ui5-tools Extension</h1>
</p>

VSCode extension for ui5 developers. This extension is not intended to replace ui5 cli, its main objective is to provide a fast and global workspace configuration to work with multi root workspaces and projects deployed to on premise systems (Gateway).

You can find examples of vscode workspace configuration in [examples](examples) folder.

## Features

### ui5-tools

- **Automatic less builder**. Looks for styles.less and {appFolderName}.less
- **Automatic themes builder**
- **Configurator** commands for odata proxy, resources proxy and replace strings

#### Server

- Configurable **proxy** to one o multiple **odata service** (Gateway, Other, None)
- Configurable **proxy** to **resources** (Gateway, CDN SAPUI5, CDN OpenUI5, None)
- Resources proxy has** built in server cache**
- Configurable UI5 version
- **Live reload browser**, css and imgages hot reload. Configurable
- **Built in localhost home** page server, with apps launchpad, readme.md, docs (md files), links, server info...
- **Built in launchpad** for resources: Gateway and CDN SAPUI5. Configurable with file `fioriSandboxConfig.json`
- Server uses **folder hierarchy**. For product apps and Z apps, is possible to emulate gateway bsp paths
- Start server in **development mode** or **production mode** (launches `distFolder` folder of each project)

#### Build

- **Component-preload.js**, checking configured ui5 version for correct build.
- **Dbg** files, configurable
- **Build less** files, configurable
- **Uglify** files, configurable
- **Replace strings**, configurable
- Build one app or all workspace commands

#### Deployer

TBD

## Settings

#### General Settings

- `ui5-tools.srcFolder`: Source folder in your app | default: `webapp,src`
- `ui5-tools.distFolder`: Source folder in your app | default: `dist`
- `ui5-tools.ui5Version`: UI5 library version for CDN proxy in server and build correct preload files: `1.71.20`

#### Server Settings

- `ui5-tools.server.name`: Server name | default: `UI5 Server`
- `ui5-tools.server.port`: Set custom port of UI5 Server | default: `3000`
- `ui5-tools.server.startOnLaunch`: Start server at launch vscode | default: `false`
- `ui5-tools.server.openBrowser`: Open browser al launch server | default: `true`
- `ui5-tools.server.watch`: Activate live reload | default: `true`
- `ui5-tools.server.watchExtensions`: Extensions to listen for live reload | default: `css,js,json,xml,html,properties`
- `ui5-tools.server.protocol`: Should use http or https | default: `http`
- `ui5-tools.server.odataProxy`: Proxy all odata calls to a server | default: `None`
- `ui5-tools.server.odataUri`: Your odata server uri url (example: `http://srvaspgwd.com:8080/`). odataProxy `Other` accepts multiple uris (example: `http://srvaspgwd.com:8080/, http://srvaspgwd.com:8080/`)
- `ui5-tools.server.odataMountPath`: The mountpath for 'Other' odataProxy. Accepts multiple paths, respecting the same order that odataUri for odataProxy type `Other` | default: `/odata`
- `ui5-tools.server.resourcesProxy`: Proxy all odata calls to a gateway, cdn or local folder (proxy all url begining with /resources) | default: `CDN SAPUI5`
- `ui5-tools.server.resourcesUri`: Your resources server url (example: http://srvaspgwd.com:8080/)

#### Builder Settings

- `ui5-tools.builder.debugSources`: Create debug js files when building | default: `true`
- `ui5-tools.builder.uglifySources`: Uglify Component-preload.js and all js files when building | default: `true`
- `ui5-tools.builder.buildLess`: Auto build less files into css when saving changes | default: `true`
- `ui5-tools.builder.replaceStrings`: Replace strings when building | default: `true`
- `ui5-tools.builder.replaceExtensions`: File extensions to look for keys to replace | default: `xml,js,json,properties`
- `ui5-tools.builder.replaceKeysValues`: Key/Value pair list. Replace <% key %> with 'value' while building the app | default: `[{'key':'TIMESTAMP','value':'COMPUTED_TIMESTAMP'}]`

#### Deployer Settings

- TBD

## Commands

#### Server Commands

- `ui5-tools.server.startDevelopment`: Start server in development mode (srcFolder)
- `ui5-tools.server.startProduction`: Start server in production mode (distFolder)
- `ui5-tools.server.startBuildProduction`: Build workspace and start server in production mode
- `ui5-tools.server.stop`: Stop server
- `ui5-tools.server.restart`: Restart server
- `ui5-tools.server.toggle`: Toggle server

#### Builder Commands

- `ui5-tools.builder.build`: Build ui5 app
- `ui5-tools.builder.buildAll`: Build workspace

#### Configurator Commands

- `ui5-tools.configurator.odataProvider`: configure odata provider
- `ui5-tools.configurator.ui5Provider`: configure ui5 provider
- `ui5-tools.configurator.replaceStrings`: configure replace strings
