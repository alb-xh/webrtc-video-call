const path = require('path');

module.exports = {
  entry: './src/client/index.js',
  mode: 'production',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'public'),
  },
};