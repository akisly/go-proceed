// Metro does not follow pnpm's symlinked workspace layout by default: it
// resolves from the app directory only, so `@aktflow/tokens` would not be
// found and its transitive deps would resolve to the wrong copy.
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
// pnpm's store means one physical copy per version; without this Metro can
// pick a second React and the app white-screens with no useful error.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
