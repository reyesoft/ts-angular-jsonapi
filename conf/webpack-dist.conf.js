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
        // })
    ],
    output: {
        // https://webpack.github.io/docs/library-and-externals.html
        path: path.join(process.cwd(), conf.paths.dist),
        library: 'ts-angular-jsonapi',
        libraryTarget: 'commonjs',
        filename: 'ts-angular-js.js'
    },
    externals: {
        'angular': 'angular'
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
    entry: `./${conf.path.src('library/index')}`,
    ts: {
        configFileName: 'conf/ts.conf.json'
    },
    tslint: {
        configuration: require('../tslint.json')
    }
};
