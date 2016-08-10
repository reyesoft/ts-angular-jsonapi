const webpack = require('webpack');
const conf = require('./gulp.conf');
const path = require('path');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const SplitByPathPlugin = require('webpack-split-by-path');
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const autoprefixer = require('autoprefixer');

module.exports = {
    module: {
        loaders: [
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
    plugins: [
        new webpack.optimize.OccurrenceOrderPlugin(),
        new webpack.NoErrorsPlugin(),
        // new webpack.optimize.UglifyJsPlugin({
        //     compress: {unused: true, dead_code: true} // eslint-disable-line camelcase
        // }),
        new SplitByPathPlugin([{
          name: 'demo-',
          path: path.join(__dirname, '../src/demo')
        }]),
        new SplitByPathPlugin([{
          name: 'ts-angular-jsonapi',
          path: path.join(__dirname, '../src/library')
        }]),
    ],
    output: {
        path: path.join(process.cwd(), conf.paths.dist),
        // filename: '[name]-[hash].js'
        filename: '[name].js'
    },
    resolve: {
        extensions: [
            '',
            '.webpack.js',
            '.web.js',
            '.js',
            '.ts'
        ]
    },
    entry: {
        app: [
            `./${conf.path.src('library/index')}`,
            `./${conf.path.tmp('templateCacheHtml.ts')}`
        ]
    },
    ts: {
        configFileName: 'conf/ts.conf.json'
    },
    tslint: {
        configuration: require('../tslint.json')
    }
};
