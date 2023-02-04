module.exports = {
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  transformIgnorePatterns: ['/.*/'],
  preset: '@shelf/jest-mongodb',
  // https://github.com/shelfio/jest-mongodb#6-jest-watch-mode-gotcha
  watchPathIgnorePatterns: ['globalConfig'],
};
