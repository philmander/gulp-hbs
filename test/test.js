var assert = require('assert');
var gutil = require('gulp-util');
var fs = require('fs');
var vfs = require('vinyl-fs');
var hbs = require('../');
var ExpectSingleFile = require('./ExpectSingleFile');

function testfile(relpath) {
    return require.resolve('./' + relpath);
}

it('should generate an html document', function(done) {

    hbs.registerHelper('fullName', function(person) {
        return person.firstName + " " + person.lastName;
    });

    vfs.src('data.json', {cwd: __dirname})
        .pipe(hbs(testfile('template.hbs')))
        .pipe(ExpectSingleFile(
            fs.readFileSync(testfile('expected.html'), 'utf-8'),
            { relative: 'data.html' },
            done));
});
