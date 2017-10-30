var path = require("path")

module.exports = {

  entry: path.resolve(__dirname, "src/JsPlot3D.js"),

  output: {
    path: path.resolve(__dirname, "compiled"),
    filename: "JsPlot3D.js",
    library: "JSPLOT3D"
  },

  module: {
    loaders: [{
        test: /\.js/,
        exclude: /node_modules/,
        loader: "babel-loader",
        query: { presets:["env"] }
      }]
  },

  externals: {
    // add unminified three code to the bundle
    // "three": "THREE"
  }
};