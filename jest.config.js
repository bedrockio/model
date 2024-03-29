process.env.ENV_NAME = 'test';
process.env.MONGO_MEMORY_SERVER_FILE = 'jest-mongodb-config.cjs';

export default {
  preset: '@shelf/jest-mongodb',
  setupFilesAfterEnv: ['<rootDir>/test/setup'],
  // https://github.com/shelfio/jest-mongodb#6-jest-watch-mode-gotcha
  watchPathIgnorePatterns: ['globalConfig'],
};
