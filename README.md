<p align="center">
<img src="images/logo_blue.png" width="100" />
<h1 align="center">ui5-tools Extension</h1>
</p>

VSCode extension for ui5 developers. This extension is not intended to replace ui5 cli, its main objective is to provide a fast and global workspace configuration to work with multi root workspaces and projects deployed to on premise systems (Gateway).

You can find examples of vscode workspace configuration in [examples](examples) folder.

## Features

#### Server

For local development, with configurable proxy to odata service (Gateway) and proxy to resources (Gateway, CDN SAPUI5, CDN OpenUI5), ui5 version is configurable also.

#### Build

Component-preload.js, checking ui5 version configured for correct build. Also creates dbg files, uglify, etc.

#### Deployer

TBD

#### Tester tools

TBD

## Settings

#### General Settings

- `ui5-tools.srcFolder`: source folder in your app | default: `webapp,src`
- `ui5-tools.distFolder`: source folder in your app | default: `dist`
- `ui5-tools.ui5Version`: UI5 library version for CDN proxy in server and build correct preload files: `1.71.20`

#### Server Settings

- `ui5-tools.server.name`: server name | default: `UI5 Server`
- `ui5-tools.server.serveFolder`: folder to serve, references to general settings `ui5-tools.srcFolder` and `ui5-tools.distFolder` | default: `Source Folder`
- `ui5-tools.server.port`: set custom port number of UI5 Server | default: `3000`
- `ui5-tools.server.startOnLaunch`: start server at launch vscode | default: `false`
- `ui5-tools.server.openBrowser`: open browser al launch server | default: `true`
- `ui5-tools.server.watch`: activate live reload | default: `true`
- `ui5-tools.server.watchExtensions`: extensions to listen for live reload | default: `css,js,json,xml,html,properties`
- `ui5-tools.server.protocol`: dhould use http or https | default: `http`
- `ui5-tools.server.odataProxy`: Proxy all odata calls to a server | default: `None`
- `ui5-tools.server.odataUri`: Your odata server uri url (example: `http://srvaspgwd.com:8080/`). odataProxy `Other` accepts multiple uris (example: `http://srvaspgwd.com:8080/, http://srvaspgwd.com:8080/`)
- `ui5-tools.server.odataMountPath`: The mountpath for 'Other' odataProxy. Accepts multiple paths, respecting the same order that odataUri for odataProxy type `Other` | default: `/odata`
- `ui5-tools.server.resourcesProxy`: proxy all odata calls to a gateway, cdn or local folder (proxy all url begining with /resources) | default: `CDN SAPUI5`

#### Builder Settings

- `ui5-tools.builder.debugSources`: Create debug js files when building | default: `true`
- `ui5-tools.builder.uglifySources`: Uglify Component-preload.js and all js files when building | default: `true`
- `ui5-tools.builder.buildLess`: Auto build less files into css when saving changes | default: `true`

#### Deployer Settings

- TBD

## Commands

#### Server Commands

- `ui5-tools.server.start`: start server
- `ui5-tools.server.stop`: stop server
- `ui5-tools.server.restart`: restart server

#### Configurator Commands

- `ui5-tools.configurator.odataProvider`: configure odata provider
- `ui5-tools.configurator.ui5Provider`: configure ui5 provider

#### Builder Commands

- `ui5-tools.builder.build`: build ui5 project
