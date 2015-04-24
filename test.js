var assert = require('assert');
var gutil = require('gulp-util');
var fs = require('fs');
var hbs = require('./')

var expectedHtml = fs.readFileSync('./test/expected.html', 'utf-8');
var json = fs.readFileSync('./test/data.json', 'utf-8');

it('should generate an html document', function (done) {

    hbs.registerHelper('fullName', function(person) {
        return person.firstName + " " + person.lastName;
    });


    var stream = hbs('./test/template.hbs');

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