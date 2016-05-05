'use strict';

var gulp = require('gulp'),
debug = require('gulp-debug'),
inject = require('gulp-inject'),
tsc = require('gulp-typescript'),
tslint = require('gulp-tslint'),
sourcemaps = require('gulp-sourcemaps'),
del = require('del'),
Config = require('./gulpfile.config'),
tsProject = tsc.createProject('tsconfig.json'),
browserSync = require('browser-sync'),
superstatic = require( 'superstatic' );

var config = new Config();

/**
* Lint all custom TypeScript files.
*/
gulp.task('ts-lint', function () {
    return gulp.src(config.allTypeScript).pipe(tslint()).pipe(tslint.report('prose'));
});

gulp.task('compile-ts', function () {
    var sourceTsFiles = [config.allTypeScript,                //path to typescript files
        config.libraryTypeScriptDefinitions
    ]; //reference to library .d.ts files

    var tsResult = gulp.src(sourceTsFiles)
    .pipe(sourcemaps.init())
    .pipe(tsc(tsProject));

    tsResult.dts.pipe(gulp.dest(config.tsOutputPath));
    return tsResult.js
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(config.tsOutputPath));
});

/**
* Remove all generated JavaScript files from TypeScript compilation.
*/
gulp.task('clean-ts', function (cb) {
    var typeScriptGenFiles = [
        config.tsOutputPath +'/**/*.js',    // path to all JS files auto gen'd by editor
        config.tsOutputPath +'/**/*.js.map', // path to all sourcemap files auto gen'd by editor
        '!' + config.tsOutputPath + '/lib'
    ];

    // delete the files
    del(typeScriptGenFiles, cb);
});

gulp.task('watch', function() {
    gulp.watch(['./src/**/*.ts'], ['lib', 'demo']);
});



var concat = require('gulp-concat');
var ts = require('gulp-typescript');
var sourcemaps = require('gulp-sourcemaps');
var ngAnnotate = require('gulp-ng-annotate');
var uglify = require('gulp-uglify');

gulp.task('lib', function() {
    var tsResult = gulp.src(['src/library/**/*.ts', 'src/*.ts'])
    .pipe(sourcemaps.init()) // This means sourcemaps will be generated
    .pipe(ts({
        sortOutput: true,
    }));

    return tsResult.js
    .pipe(ngAnnotate())
    .pipe(concat('ts-angular-jsonapi.js')) // You can use other plugins that also support gulp-sourcemaps
    .pipe(sourcemaps.write()) // Now the sourcemaps are added to the .js file
    .pipe(gulp.dest('build'));
});

var merge = require('merge-stream');
gulp.task('dist', function() {

    // get ts interfaces
    var tsResult = gulp.src(['src/library/**/*.ts', 'src/library/**/*.d.ts', 'typings/browser/**/*.d.ts'])
    .pipe(ts({
        declarationFiles: true,
        declaration: true,
        noExternalResolve: true,
        noImplicitAny: false,
        removeComments: false,
        target: 'ES5',
        emitDecoratorMetadata: false
    }));
    var content1 = tsResult.dts;

    // get ts definitions
    var content2 = gulp.src(['src/library/**/*.d.ts'])
    .pipe(sourcemaps.init()) // This means sourcemaps will be generated
    .pipe(concat('ts-angular-jsonapi.d.ts')) // You can use other plugins that also support gulp-sourcemaps
    .pipe(sourcemaps.write()) // Now the sourcemaps are added to the .js file
    ;

    // put all ts information
    var final_content = merge(content1, content2);
    final_content
        .pipe(concat('tsd.d.ts'))
        .pipe(gulp.dest('dist'))

    // get all ts information for compression
    var tsResult = gulp.src(['src/library/**/*.ts', 'src/*.ts'])
    .pipe(sourcemaps.init()) // This means sourcemaps will be generated
    .pipe(ts({
        sortOutput: true,
    }));

    // library
    tsResult.js
    .pipe(ngAnnotate())
    .pipe(concat('ts-angular-jsonapi.js')) // You can use other plugins that also support gulp-sourcemaps
    .pipe(sourcemaps.write()) // Now the sourcemaps are added to the .js file
    .pipe(gulp.dest('dist'));

    // mifified library
    return tsResult.js
    .pipe(ngAnnotate())
    .pipe(uglify())
    .pipe(concat('ts-angular-jsonapi.min.js')) // You can use other plugins that also support gulp-sourcemaps
    .pipe(gulp.dest('dist'));
});

gulp.task('demo', function() {
    var tsResult = gulp.src('src/demo/**/*.ts')
    .pipe(sourcemaps.init()) // This means sourcemaps will be generated
    .pipe(ts({
        sortOutput: true,
    }));

    return tsResult.js
    .pipe(ngAnnotate())
    .pipe(concat('demo.js')) // You can use other plugins that also support gulp-sourcemaps
    .pipe(sourcemaps.write()) // Now the sourcemaps are added to the .js file
    .pipe(gulp.dest('build'));
});

gulp.task('serve', ['lib', 'demo', 'watch'], function() {
    process.stdout.write('Starting browserSync and superstatic...\n');
    browserSync({
        port: 3000,
        files: ['index.html', '**/*.js'],
        injectChanges: true,
        logFileChanges: false,
        logLevel: 'silent',
        logPrefix: 'angularin20typescript',
        notify: true,
        reloadDelay: 0,
        server: {
            baseDir: './src/demo',
            middleware: superstatic({ debug: false})
        }
    });
});

gulp.task('default', ['dist']);
