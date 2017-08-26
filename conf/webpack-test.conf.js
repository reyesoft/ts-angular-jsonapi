module.exports = {
  module: {
    // https://github.com/localForage/localForage#browserify-and-webpack
    noParse: /node_modules\/localforage\/dist\/localforage.js/,

    preLoaders: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        loader: 'tslint'
      }
    ],

    loaders: [
      {
        test: /.json$/,
        loaders: [
          'json'
        ]
      },
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        loaders: [
          'ng-annotate',
          'ts'
        ]
      }
    ]
  },
  plugins: [],
  debug: true,
  devtool: 'cheap-module-eval-source-map',
  resolve: {
    extensions: [
      '',
      '.webpack.js',
      '.web.js',
      '.js',
      '.ts'
    ]
  },
  ts: {
    configFile: 'tsconfig.json'
  },
  tslint: {
    configuration: require('../tslint.json')
  }
};
