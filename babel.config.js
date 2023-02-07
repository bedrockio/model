export default {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: '16.13.0',
        },
      },
    ],
  ],
  plugins: ['lodash'],
};
