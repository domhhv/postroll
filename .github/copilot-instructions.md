When generating a commit message, follow the Conventional Commits format. The commit message should be structured as follows:

```text
<type>[optional scope]: <description>

[optional body]
```

The type should be one of the following:

```json
{
  "types": {
    "feat": {
      "description": "A new feature",
      "title": "Features"
    },
    "fix": {
      "description": "A bug fix",
      "title": "Bug Fixes"
    },
    "docs": {
      "description": "Documentation only changes",
      "title": "Documentation"
    },
    "style": {
      "description": "Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)",
      "title": "Styles"
    },
    "refactor": {
      "description": "A code change that neither fixes a bug nor adds a feature",
      "title": "Code Refactoring"
    },
    "perf": {
      "description": "A code change that improves performance",
      "title": "Performance Improvements"
    },
    "test": {
      "description": "Adding missing tests or correcting existing tests",
      "title": "Tests"
    },
    "build": {
      "description": "Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm)",
      "title": "Builds"
    },
    "ci": {
      "description": "Changes to our CI configuration files and scripts (example scopes: Travis, Circle, BrowserStack, SauceLabs)",
      "title": "Continuous Integrations"
    },
    "chore": {
      "description": "Other changes that don't modify src or test files",
      "title": "Chores"
    },
    "revert": {
      "description": "Reverts a previous commit",
      "title": "Reverts"
    }
  }
}
```

The scope should be the name of the app, package, or feature affected by the change (e.g. `web`, `gateway`, `auth`, `layout`, `config` etc.). The scope can also be omitted if the change affects multiple features.

The commit message should be written in the imperative mood (e.g. "fix bug" instead of "fixed bug" or "fixes bug") and always be lowercase, even for proper nouns. Kebab-case is allowed for the words that otherwise would have another case (e.g. "feat(layout): move account-details component from header to sidebar" instead of "feat(layout): move AccountDetails component from header to sidebar").

The body should consist of a short description of the change (up to three sentences) and a list of any breaking changes.

The body should also include any relevant information about the change, such as why it was made, how it was implemented, and any potential side effects.
