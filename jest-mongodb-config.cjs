// Note this file MUST be a CJS module as it will be required
// by @shelf/jest-mongodb. Note also that the binary version
// does not match the mongodb driver version.

module.exports = {
  mongodbMemoryServerOptions: {
    binary: {
      version: '6.0.2',
      skipMD5: true,
    },
    autoStart: false,
    instance: {},
  },
};
