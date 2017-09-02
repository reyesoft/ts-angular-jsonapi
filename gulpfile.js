const gulp = require('gulp');
const HubRegistry = require('gulp-hub');
const browserSync = require('browser-sync');

const conf = require('./conf/gulp.conf');

// Load some files into the registry
const hub = new HubRegistry([conf.path.tasks('*.js')]);

// Tell gulp to use the tasks just loaded
gulp.registry(hub);

gulp.task('build', gulp.parallel('build:demo', 'build:library'));
gulp.task('build:library', gulp.series('clean:library', gulp.parallel('other', 'webpack:library', 'library:dts')));
gulp.task('build:demo', gulp.series('clean:demo', 'partials', gulp.parallel('other', 'webpack:demo')));
gulp.task('test', gulp.series('karma:single-run'));
gulp.task('serve', gulp.series('webpack:watch', 'watch', 'browsersync'));
gulp.task('default', gulp.series('build:library'));
gulp.task('watch', watch);

function reloadBrowserSync(cb) {
  browserSync.reload();
  cb();
}

function watch(done) {
  gulp.watch(conf.path.src('demo/**/*.html'), reloadBrowserSync);
  done();
}
