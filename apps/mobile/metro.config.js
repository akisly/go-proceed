// Metro resolves from the app directory only by default, so it would not find
// workspace packages like `@goproceed/tokens` without watchFolders and
// nodeModulesPaths pointing at the monorepo root.
//
// Hierarchical lookup is deliberately LEFT ON: pnpm stores each package's own
// dependencies beside it (as symlinks inside that package's own node_modules)
// rather than hoisting them to the root, and hierarchical lookup is the
// mechanism Metro uses to walk up and find them. Disabling it breaks
// resolution of any package's transitive dependencies that aren't hoisted to
// the two roots below — it is Yarn/npm-hoisting advice that does not apply to
// pnpm's layout.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
