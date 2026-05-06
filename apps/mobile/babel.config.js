module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@api': './src/api',
          '@screens': './src/screens',
          '@components': './src/components',
          '@store': './src/store',
          '@hooks': './src/hooks',
          '@offline': './src/offline',
          '@theme': './src/theme',
          '@utils': './src/utils',
          '@types': './src/types',
          '@navigation': './src/navigation',
        },
      },
    ],
    'react-native-reanimated/plugin',
  ],
};
