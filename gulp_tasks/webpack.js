const gulp = require('gulp');
const gutil = require('gulp-util');

const webpack = require('webpack');
const webpackConf = require('../conf/webpack.conf');
const webpackDistConf = require('../conf/webpack-dist.conf');
const gulpConf = require('../conf/gulp.conf');
const browsersync = require('browser-sync');

// modification by pablorsk for especial dist
const concat = require('gulp-concat');
var clean = require('gulp-clean');
var deleteLines = require('gulp-delete-lines');
var ts = require('gulp-typescript');
var addsrc = require('gulp-add-src');
var replace = require('gulp-replace');
var inject = require('gulp-inject-string');

gulp.task('webpack:dev', done => {
  webpackWrapper(false, webpackConf, done);
});

gulp.task('webpack:watch', done => {
  webpackWrapper(true, webpackConf, done);
});

gulp.task('webpack:dist', done => {
  process.env.NODE_ENV = 'production';
  webpackWrapper(false, webpackDistConf, done);
});

function webpackWrapper(watch, conf, done) {
  const webpackBundler = webpack(conf);

  const webpackChangeHandler = (err, stats) => {
    if (err) {
      gulpConf.errorHandler('Webpack')(err);
    }
    gutil.log(stats.toString({
      colors: true,
      chunks: false,
      hash: false,
      version: false
    }));
    if (done) {
      done();
      done = null;
    } else {
      browsersync.reload();
    }
  };

  if (watch) {
    webpackBundler.watch(200, webpackChangeHandler);
  } else {

    // clear folder
    gulp.src('dist/*', {read: false})
    .pipe(clean());

    var tsProjectDts = ts.createProject('conf/ts.conf.json');
    var tsResult = gulp.src('src/library/**.ts')
    .pipe(tsProjectDts());
    tsResult.dts
    .pipe(deleteLines({
      'filters': [ /^\/\/\//i]
    }))
    .pipe(addsrc.prepend('src/library/interfaces/**.d.ts'))
    .pipe(concat('index.d.ts'))
    .pipe(deleteLines({
      'filters': [ /^import/i]
    }))
    .pipe(deleteLines({
      'filters': [ /^export [\*|\{]/i]
      }))

      .pipe(replace(/export declare class/g, 'export class')) // because all is on a "export module Jsonapi"
      .pipe(inject.wrap("export module Jsonapi { \n", '}'))

      .pipe(gulp.dest('dist'));
      ;

      webpackBundler.run(webpackChangeHandler);
    }
  }
