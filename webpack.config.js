var path = require('path');

module.exports = {
  entry: path.resolve(__dirname, 'src/app.js'),
  output: {
    path: path.resolve(__dirname, 'public'),
    filename: 'bundle.js'
  },

  module: {
    loaders: [{
        test: /\.js/,
        exclude: /node_modules/,
        loader: "babel-loader",
        query: { presets:["env"] }
      }]
  }
};
