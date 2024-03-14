# gitlab-flowboost-beta
The "gitlab-flowboost-beta" is a CLI tool designed to enhance and streamline the GitLab workflow for developers and teams. It automates and simplifies various GitLab operations, making it easier for developers to follow specific workflows, such as creating feature branches, pushing changes, and opening merge requests. This tool is particularly useful for teams looking to enforce certain naming conventions and merge request practices.

## Features
- **Smart Branch Creation:** Create branches that adhere to your project's naming conventions with guided prompts.
- **Alias Execution:** Simplify your Git workflow with easy-to-use aliases. Execute complex Git operations with simple commands.
- **Configurability**: Comes with default settings but allows custom configurations for branch naming, merge request options, and more.
- **Automated Workflows**: Automates creation of merge requests, branch creation adhering to naming conventions, and commit management.
- **User Notifications:** Stay informed about important events with desktop notifications, keeping you up-to-date about important events like merge conflicts etc... without needing to monitor the terminal.

## Installation

To install the package globally, use:

```bash
npm install -g gitlab-flowboost-beta
```

For local project use:

```bash
npm install gitlab-flowboost-beta
```
# Usage
## 1- Global Usage
If installed globally, you can use the predefined aliases directly from your terminal:

```bash
flow-boost <alias-name> [arguments]
```
## 2- Local Usage in npm Scripts
Add the desired aliases as scripts in your project's package.json:

```json
"scripts": {
    "you command name": "flow-boost <alias-name> [arguments]"
}
```
And run them with npm:
```bash
npm run <you command name>
```

## Configuration

To customize the behavior of the Git commands aliases, you need to create a `flowboost-config.json` file in the root of your project. This configuration file should follow the structure shown in the example below:

```json
{
    "mode": "dev",
    "mergeRequestOptions": {
      "allowToCreateTempBranches": true,
      "setToDeleteBranchAfterMainMerge": false,
      "branches": [
        {
          "name": "env/dev",
          "requiredLabels": ["dev"],
          "isDraftPR": false,
          "isMainBranch": false
        },
        {
          "name": "env/stage",
          "requiredLabels": ["stage"],
          "isDraftPR": true,
          "isMainBranch": false
        },
        {
          "name": "master",
          "requiredLabels": ["master"],
          "isDraftPR": true,
          "isMainBranch": true
        }
      ]
    },
    "branchesOptions": {
      "namingConventions": {
        "feature": {
          "template": "feature/${issueId}-${description}",
          "placeHoldersValidation": {
            "issueId": "^\\d+$",
            "description": "^.{1,50}$"
          },
          "finalValidationRegex": "^feature\\/\\w+-.*$",
          "defaultBaseBranch": "master"
        },
        "hotfix": {
          "template": "hotfix/${issueId}-${description}",
          "placeHoldersValidation": {
            "issueId": "^\\d+$",
            "description": "^.{1,50}$"
          },
          "defaultBaseBranch": "master"
        },
        "merge": {
          "template": "merge/${issueId}-${targetEnvironement}",
          "placeHoldersValidation": {
            "issueId": "^\\d+$",
            "description": "^.{1,50}$"
          },
          "defaultBaseBranch": "env/dev"
        }
      }
    }
}
```

In this configuration file:

- `mode`: Defines the operational mode of the tool. Available modes include "dev" for development and potentially other modes like "prod" for production, affecting various tool behaviors.

- `mergeRequestOptions`: Contains settings related to merge request creation and management.
  - `allowToCreateTempBranches`: When set to `true`, enables the creation of temporary branches for managing merge requests.
  - `setToDeleteBranchAfterMainMerge`: If `true`, configures merge requests to delete the source branch after merging automatically.
  - `branches`: An array of branch configurations, each defining custom behaviors for different branches.
    - `name`: The name of the branch.
    - `requiredLabels`: An array of labels required for merge requests targeting this branch.
    - `isDraftPR`: Determines if merge requests to this branch should be marked as draft/pending by default.
    - `isMainBranch`: When `true`, indicates that the first merge request created using the tool should target this branch.

- `branchesOptions`: Configures options related to branch handling and naming conventions.
  - `defaultBranchNamingConvention`: A template for automatically generating new branch names.
  - `regexNamingValidation`: A regular expression for validating new branch names against a specific pattern.
  - `namingConventions`: An object defining different naming conventions for various types of branches (e.g., feature, hotfix).
    - Each naming convention can include:
      - `template`: A string template for generating branch names.
      - `placeHoldersValidation`: An object containing regular expressions for validating placeholders within the template.
      - `finalValidationRegex`: A regular expression to validate the final branch name.
      - `defaultBaseBranch`: Specifies the default base branch for new branches of this type.

Customize the `branches` array according to your project's branches and the labels you want to associate with each branch for merge requests.

# Available Aliases

## 1- Create Merge Request

**Alias:** `push-mr`
- Pushes your current branch and creates a merge request for the specified target branch.

**Parameters:**

- `targetBranch`: The target branch for the merge request. Defaults to `'master'` if not specified.

## 2- Smart Branch Creation

**Alias:** `smart-branch`

- Create a new branch based on the branch strategy you specified in your config file

## 3- Create Merge Requests for All Branches

**Alias:** `push-mr-all`

- Creates merge requests for all branches defined in the configuration to the specified target branch.

## 4- Commit Changes, push them and Create Merge Requests for All Branches

**Alias:** `commit-push-mr-all`

- Stages all changes, commits them with the given message, push them to the server and then creates merge requests for all branches defined in the configuration.

**Parameters:**

- `commitMessage`: The commit message to use for the new commit.

## 5- Conflict Checker

**Alias:** `conflict-check`

- Check if there is any conflicts between your current branch and the target branch

**Parameters:**

- `targetBranch`: The branch you are trying to check a conflict against ex: dev or stage.

## Extending
To add more aliases or customize existing ones, modify the aliases.js file in your local copy of the package.

## Contributing
Contributions are welcome! Please feel free to submit issues or pull requests to the project repository.

## License
This project is licensed under the MIT License.

[Donate with PayPal](https://www.PayPal.Me/nitrobotic)