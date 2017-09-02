const gulp = require('gulp');
const htmlmin = require('gulp-htmlmin');
const angularTemplatecache = require('gulp-angular-templatecache');
const insert = require('gulp-insert');

const conf = require('../conf/gulp.conf');

gulp.task('partials', partials);

function partials() {
  return gulp.src(conf.path.src('**/*.html'))
    .pipe(htmlmin())
    .pipe(angularTemplatecache('templateCacheHtml.ts', {
      module: conf.ngModule,
      // root: 'app'
    }))
    .pipe(insert.prepend('import * as angular from \'angular\';'))
    .pipe(gulp.dest(conf.path.tmp()));
}
