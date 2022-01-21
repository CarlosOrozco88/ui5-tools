// import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter, Event } from 'vscode';
// import { AppOptions, Ui5App, Ui5Apps } from '../Types/Types';

// import Utils from '../Utils/Utils';

// export class ProjectsViewClass implements TreeDataProvider<Ui5App | AppOptions> {
//   private _onDidChangeTreeData: EventEmitter<Ui5App | void | AppOptions> = new EventEmitter<
//     Ui5App | void | AppOptions
//   >();
//   readonly onDidChangeTreeData: Event<Ui5App | void | AppOptions> = this._onDidChangeTreeData.event;

//   refresh(): void {
//     this._onDidChangeTreeData.fire();
//   }

//   getTreeItem(item: Ui5App | AppOptions): TreeItem {
//     if ((item as Ui5App).folderName !== undefined) {
//       const ui5App = item as Ui5App;
//       return {
//         label: ui5App.namespace,
//         collapsibleState: TreeItemCollapsibleState.Collapsed,
//       };
//     } else {
//       const ui5Options = item as AppOptions;
//       return {
//         label: ui5Options.title,
//       };
//     }
//   }

//   async getChildren(element?: Ui5App): Promise<Ui5Apps | Array<AppOptions>> {
//     if (element) {
//       return Promise.resolve([
//         { ui5App: element, title: 'Build' },
//         { ui5App: element, title: 'Deploy' },
//       ]);
//     } else {
//       return Utils.getAllUI5Apps();
//     }
//   }
// }

// export const ProjectsView = new ProjectsViewClass();
// ProjectsView.refresh();

/*
"viewsContainers": {
      "activitybar": [
        {
          "id": "ui5toolscontainer",
          "title": "Ui5 Tools",
          "icon": "static/images/logo_blue.png"
        }
      ]
    },
    "views": {
      "ui5toolscontainer": [
        {
          "type": "tree",
          "id": "ui5toolsprojects",
          "name": "UI5 Projects"
        },
        {
          "type": "tree",
          "id": "ui5toolsserver",
          "name": "UI5 Server"
        }
      ]
    },
    "viewsWelcome": [
      {
        "view": "ui5toolsprojects",
        "contents": "In order to use git features, you can open a folder containing a git repository or clone from a URL.\n[Open Folder](command:vscode.openFolder)\n[Clone Repository](command:git.clone)\nTo learn more about how to use git and source control in VS Code [read our docs](https://aka.ms/vscode-scm)."
      }
    ],
    */
