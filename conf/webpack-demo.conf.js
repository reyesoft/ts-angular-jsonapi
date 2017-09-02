const webpack = require('webpack');
const conf = require('./gulp.conf');
const path = require('path');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const pkg = require('../package.json');
const autoprefixer = require('autoprefixer');

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
        test: /\.(eot|woff|woff2|svg|ttf|png|jpg|jpeg)([\?]?.*)$/, loader: 'file-loader'
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
    new webpack.NoEmitOnErrorsPlugin(),
    // new webpack.ProvidePlugin({
    //   "window.jQuery": "jquery"
    // }),
    new HtmlWebpackPlugin({
      template: conf.path.src('index.html')
    }),
    // new webpack.optimize.UglifyJsPlugin({
    //   output: {comments: false},
    //   compress: {unused: true, dead_code: true} // eslint-disable-line camelcase
    // }),
    new ExtractTextPlugin('index-[contenthash].css'),
    new webpack.optimize.CommonsChunkPlugin({name: 'vendor'}),
    new webpack.LoaderOptionsPlugin({
      options: {
        postcss: () => [autoprefixer],
        resolve: {},
        ts: {
          configFile: 'tsconfig.json'
        },
        tslint: {
          configuration: require('../tslint.json')
        }
      }
    })
  ],
  output: {
    path: path.join(process.cwd(), conf.paths.distdemo),
    filename: '[name]-[hash].js'
  },
  resolve: {
    extensions: [
      '.webpack.js',
      '.web.js',
      '.js',
      '.ts'
    ]
  },
  entry: {
    app: [
      `./${conf.path.src('index')}`,
      `./${conf.path.tmp('templateCacheHtml.ts')}`
    ],
    vendor: Object.keys(pkg.peerDependencies).concat(Object.keys(pkg.dependencies))
    // vendor: Object.keys(pkg.dependencies)
  }
};
