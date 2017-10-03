var path = require('path');

module.exports = {
  entry: path.resolve(__dirname, 'src/3Dplot.js'),
  output: {
    path: path.resolve(__dirname, 'public'),
    filename: '3DPlotBundle.js'
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
