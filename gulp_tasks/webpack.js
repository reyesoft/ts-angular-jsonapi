const gulp = require('gulp');
const gutil = require('gulp-util');

const webpack = require('webpack');
const webpackConf = require('../conf/webpack.conf');
const webpackDemoConf = require('../conf/webpack-demo.conf');
const webpackLibraryConf = require('../conf/webpack-library.conf');
const gulpConf = require('../conf/gulp.conf');
const browsersync = require('browser-sync');

// modification by pablorsk for especial dist
var clean = require('gulp-clean');

gulp.task('webpack:watch', done => {
  webpackWrapper(true, webpackConf, done);
});

gulp.task('webpack:demo', done => {
  webpackWrapper(false, webpackDemoConf, done);
});

gulp.task('webpack:library', done => {
  webpackWrapper(false, webpackLibraryConf, done);
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

    webpackBundler.run(webpackChangeHandler);
  }
}
