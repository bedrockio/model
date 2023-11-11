const { devDependencies } = require('./package.json');

module.exports = {
  mongodbMemoryServerOptions: {
    binary: {
      version: devDependencies.mongodb,
      skipMD5: true,
    },
    autoStart: false,
    instance: {},
  },
};
