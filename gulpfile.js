const gulp = require('gulp')
const inlinesource = require('gulp-inline-source')
const replace = require('gulp-replace')

gulp.task('default', () => {
    return gulp.src('./excalidraw/build/index.html')
        .pipe(replace('.js"></script>', '.js" inline></script>'))
        .pipe(replace('rel="stylesheet">', 'rel="stylesheet" inline>'))
        .pipe(inlinesource({
            compress: false,
        }))
        .pipe(gulp.dest('./media/'))
});
