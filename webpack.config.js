const path = require("path");

module.exports = {
  entry: "./src/easystaticmap.ts",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  output: {
    filename: "easystaticmap.js",
    path: path.resolve(__dirname, "dist"),
    library: "EasyStaticMap",
    libraryTarget: "umd",
    globalObject: "this",
  },
  devtool: "source-map",
};
