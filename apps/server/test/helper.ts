import helper from "fastify-cli/helper.js";
// This file contains code that we reuse between our tests.

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./data/test.db";
}

const AppPath = `${import.meta.dir}/../src/app.ts`;

// Fill in this config with all the configurations
// needed for testing the application
function config() {
  return {
    skipOverride: true, // Register our application with fastify-plugin
  };
}

// Automatically build and tear down our instance
async function build() {
  // you can set all the options supported by the fastify CLI command
  const argv = [AppPath];

  // fastify-plugin ensures that all decorators
  // are exposed for testing purposes, this is
  // different from the production setup
  const app = await helper.build(argv, config());

  return app;
}

export { config, build };
