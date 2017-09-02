var gulp = require('gulp');
var ghPages = require('gulp-gh-pages');

gulp.task('ghpages', function() {
  return gulp.src('./dist-demo/**/*')
    .pipe(ghPages());
});
