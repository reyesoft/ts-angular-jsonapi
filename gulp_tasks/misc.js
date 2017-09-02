const path = require('path');

const gulp = require('gulp');
const del = require('del');
const filter = require('gulp-filter');

const conf = require('../conf/gulp.conf');
// const webpackconf = require('../conf/webpack.conf');

gulp.task('clean:tmp', cleanTmp);
gulp.task('clean:demo', gulp.parallel('clean:tmp', cleanDemo));
gulp.task('clean:library', gulp.parallel('clean:tmp', cleanLibrary));
gulp.task('other', other);

function cleanTmp() {
  return del([conf.paths.tmp]);
}
function cleanDemo() {
  return del([conf.paths.dist, conf.paths.tmp]);
}
function cleanLibrary() {
  return del([conf.paths.distdemo, conf.paths.tmp]);
}

function other() {
  const fileFilter = filter(file => file.stat.isFile());

  return gulp.src([
    path.join(conf.paths.srcdist, '/**/*'),
    path.join(`!${conf.paths.srcdist}`, '/**/*.{html,ts,css,js,scss}')
  ])
    .pipe(fileFilter)
    .pipe(gulp.dest(conf.paths.dist));
}
