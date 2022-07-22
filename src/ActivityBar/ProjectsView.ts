// import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter, Event } from 'vscode';
// import { AppOptions, Ui5Project, Ui5Projects } from '../Types/Types';

// import Extension from '../Utils/Extension';
// import Finder from '../Apps/Finder';

// export class ProjectsViewClass implements TreeDataProvider<Ui5Project | AppOptions> {
//   private _onDidChangeTreeData: EventEmitter<Ui5Project | void | AppOptions> = new EventEmitter<
//     Ui5Project | void | AppOptions
//   >();
//   readonly onDidChangeTreeData: Event<Ui5Project | void | AppOptions> = this._onDidChangeTreeData.event;

//   refresh(): void {
//     this._onDidChangeTreeData.fire();
//   }

//   getTreeItem(item: Ui5Project | AppOptions): TreeItem {
//     if ((item as Ui5Project).folderName !== undefined) {
//       const ui5Project = item as Ui5Project;
//       return {
//         label: ui5Project.namespace,
//         collapsibleState: TreeItemCollapsibleState.Collapsed,
//       };
//     } else {
//       const ui5Options = item as AppOptions;
//       return {
//         label: ui5Options.title,
//       };
//     }
//   }

//   async getChildren(element?: Ui5Project): Promise<Ui5Projects | Array<AppOptions>> {
//     if (element) {
//       return Promise.resolve([
//         { ui5Project: element, title: 'Build' },
//         { ui5Project: element, title: 'Deploy' },
//       ]);
//     } else {
//       return Finder.getAllUI5Projects();
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
