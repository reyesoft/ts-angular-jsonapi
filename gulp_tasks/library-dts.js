const gulp = require('gulp');

// modification by pablorsk for especial dist
const concat = require('gulp-concat');
var deleteLines = require('gulp-delete-lines');
var ts = require('gulp-typescript');
var addsrc = require('gulp-add-src');
var replace = require('gulp-replace');
var inject = require('gulp-inject-string');
var ts = require('gulp-typescript');

gulp.task('library:dts', done => {
  makeLibraryDTs();
  done();
});

function makeLibraryDTs() {
  var tsProjectDts = ts.createProject('conf/tsconfig.build.json');
  var tsResult = gulp.src('src/library/**.ts')
    .pipe(tsProjectDts());
  tsResult.dts
    .pipe(deleteLines({
      'filters': [/^\/\/\//i]
    }))
    .pipe(addsrc.prepend('src/library/interfaces/**.d.ts'))
    .pipe(concat('index.d.ts'))
    .pipe(deleteLines({
      'filters': [/^import/i]
    }))
    .pipe(deleteLines({
      'filters': [/^export [\*|\{]/i]
    }))

    .pipe(replace(/export declare class/g, 'export class')) // because all is on a "export module Jsonapi"
    .pipe(inject.wrap('export module Jsonapi { \n', '}'))

    .pipe(gulp.dest('dist'));
}
