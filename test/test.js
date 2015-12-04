var assert = require('assert');
var gutil = require('gulp-util');
var fs = require('fs');
var hbs = require('../');

function testfile(relpath) {
    return require.resolve("./" + relpath);
}

var expectedHtml = fs.readFileSync(testfile('expected.html'), 'utf-8');
var json = fs.readFileSync(testfile('data.json'), 'utf-8');

it('should generate an html document', function (done) {

    hbs.registerHelper('fullName', function(person) {
        return person.firstName + " " + person.lastName;
    });


    var stream = hbs(testfile('template.hbs'));

    stream.on('data', function (file) {
        //fs.writeFileSync('./test/actual.html', file.contents.toString());
        assert.equal(file.path, 'data.html');
        assert.equal(file.contents.toString().trim(), expectedHtml.trim());
        done();
    });

    stream.write(new gutil.File({
        path: 'data.json',
        contents: new Buffer(json)
    }));
});
