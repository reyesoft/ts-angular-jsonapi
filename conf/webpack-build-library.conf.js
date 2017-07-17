const webpack = require('webpack');
const conf = require('./gulp.conf');
const path = require('path');

const ExtractTextPlugin = require('extract-text-webpack-plugin');

module.exports = {
  module: {
    // https://github.com/localForage/localForage#browserify-and-webpack
    noParse: /node_modules\/localforage\/dist\/localforage.js/,

    loaders: [
      {
        test: /\.json$/,
        loaders: [
          'json-loader'
        ]
      },
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        loader: 'tslint-loader',
        enforce: 'pre'
      },
      {
        test: /\.(css|scss)$/,
        loaders: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: 'css-loader?minimize!sass-loader!postcss-loader'
        })
      },
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        loaders: [
          'ng-annotate-loader',
          'ts-loader'
        ]
      },
      {
        test: /\.html$/,
        loaders: [
          'html-loader'
        ]
      }
    ]
  },
  plugins: [
    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.NoEmitOnErrorsPlugin()
    // new webpack.optimize.UglifyJsPlugin({
    //     compress: {unused: true, dead_code: true} // eslint-disable-line camelcase
    // })
  ],
  bail: true,
  output: {
    // https://webpack.github.io/docs/library-and-externals.html
    path: path.join(process.cwd(), conf.paths.dist),
    library: 'Jsonapi',
    libraryTarget: 'commonjs',
    filename: 'ts-angular-jsonapi.js'
  },
  externals: {
    'angular': 'angular'
  },
  resolve: {
    extensions: [
      '.webpack.js',
      '.web.js',
      '.js',
      '.ts'
    ]
  },
  entry: `./${conf.path.srcdist('index.ts')}`
};
