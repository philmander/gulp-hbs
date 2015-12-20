var assert = require('assert');
var gutil = require('gulp-util');
var vinyl = require('vinyl');
var fs = require('fs');
var through = require('through2');
var vfs = require('vinyl-fs');
var mockfs = require('vinyl-fs-mock');
var rewire = require('rewire');
var mergeStream = require('merge-stream');
var hbs = require('../');
var expects = require('./expects');

function testfile(relpath) {
    return require.resolve('./' + relpath);
}

it('should generate an html document', function(done) {

    hbs.registerHelper('fullName', function(person) {
        return person.firstName + " " + person.lastName;
    });

    vfs.src('data.json', {cwd: __dirname})
        .pipe(hbs(testfile('template.hbs')))
        .pipe(expects.singleFile(
            'data.html',
            fs.readFileSync(testfile('expected.html'), 'utf-8'),
            done));
});

it('mock fs should work in test framework', function(done) {
    var fs = mockfs({
        'file.txt': 'This is a file',
    });
    fs.src('*')
        .pipe(expects.singleFile('file.txt', 'This is a file', done));
});

it('should accept templates from a stream', function(done) {
    var fs = mockfs({
        'data.json': '{"foo":1, "bar":"baz", "template":"template.hbs"}',
        'template.hbs': '<p>{{foo}} and {{bar}}</p>',
    });
    fs.src('*.json')
        .pipe(hbs(fs.src('*.hbs')))
        .pipe(expects.singleFile('data.html', '<p>1 and baz</p>',
            done));
});

it('should use the only found template if none was named', function(done) {
    var fs = mockfs({
        'data.json': '{"foo":1, "bar":"baz"}',
        'template.hbs': '<p>{{foo}} and {{bar}}</p>',
    });
    fs.src('*.json')
        .pipe(hbs(fs.src('*.hbs')))
        .pipe(expects.singleFile('data.html', '<p>1 and baz</p>', done));
});

it('should use choose among several templates', function(done) {
    var fs = mockfs({
        'data1.json': '{"index":1, "template":"template1.hbs"}',
        'data2.json': '{"index":2, "template":"template2.hbs"}',
        'template1.hbs': '<p>index {{index}} template 1</p>',
        'template2.hbs': '<p>index {{index}} template 2</p>',
    });
    fs.src('*.json')
        .pipe(hbs(fs.src('*.hbs')))
        .pipe(expects.files({
            'data1.html': '<p>index 1 template 1</p>',
            'data2.html': '<p>index 2 template 2</p>',
        }, done));
});

it('should choose templates using glob-relative path', function(done) {
    var fs = mockfs({
        'data1.json': '{"index":1, "template":"template1.hbs"}',
        'data2.json': '{"index":2, "template":"xyz/template2.hbs"}',
        't': {
            'template1.hbs': '<p>index {{index}} template 1</p>',
            'xyz': {'template2.hbs': '<p>index {{index}} template 2</p>'}}
    });
    fs.src('*.json')
        .pipe(hbs(fs.src('t/**/*.hbs')))
        .pipe(expects.files({
            'data1.html': '<p>index 1 template 1</p>',
            'data2.html': '<p>index 2 template 2</p>',
        }, done));
});

it('should choose templates using nested key', function(done) {
    var fs = mockfs({
        'data1.json': '{"index":1, "meta":{"template":"template1.hbs"}}',
        'data2.json': '{"index":2, "meta":{"template":"template2.hbs"}}',
        'template1.hbs': '<p>index {{index}} template 1</p>',
        'template2.hbs': '<p>index {{index}} template 2</p>',
    });
    fs.src('*.json')
        .pipe(hbs(fs.src('*.hbs'), {templateAttribute:"meta.template"}))
        .pipe(expects.files({
            'data1.html': '<p>index 1 template 1</p>',
            'data2.html': '<p>index 2 template 2</p>',
        }, done));
});

it('should work if inputs arrive faster than templates', function(done) {
    var templateStream = new through.obj(); // pass-through
    var hbStream = hbs(templateStream);
    hbStream
        .pipe(expects.files({
            'data1.html': '<p>d1 t2</p>',
            'data2.html': '<p>d2 t2</p>',
            'data3.html': '<p>d3 t1</p>',
            'data4.html': '<p>d4 t1</p>',
        }, done));
    var timeout = 0;
    function schedule(stream, path, contents) {
        timeout += 10;
        setTimeout(function() {
            if (!path) stream.end();
            else stream.write(new vinyl({
                path: '/' + path,
                cwd: '/',
                contents: new Buffer(contents)
            }));
        }, timeout);
    }
    schedule(hbStream, 'data1.json', '{"index":1, "template":"t2.hbs"}');
    schedule(hbStream, 'data2.json', '{"index":2, "template":"t2.hbs"}');
    schedule(hbStream, 'data3.json', '{"index":3, "template":"t1.hbs"}');
    schedule(templateStream, 't1.hbs', '<p>d{{index}} t1</p>');
    schedule(templateStream, 't2.hbs', '<p>d{{index}} t2</p>');
    schedule(templateStream);
    schedule(hbStream, 'data4.json', '{"index":4, "template":"t1.hbs"}');
    schedule(hbStream);
});

it('should only read its string-named templates once', function(done) {
    function InterceptFs() { };
    InterceptFs.prototype = fs;
    var interceptFs = new InterceptFs();
    var count = 0;
    interceptFs.readFile = function(name, encoding, cb) {
        ++count;
        assert(encoding === "utf-8");
        assert.strictEqual(name, "template.hbs");
        cb(null, '<p>{{content}}</p>');
    };
    var hbs = rewire('../');
    hbs.__set__("fs", interceptFs);
    var fs = mockfs({
        'data1.json': '{"content":1}',
        'data2.json': '{"content":2}',
    });
    fs.src('data1.json')
        .pipe(hbs("template.hbs"))
        .pipe(expects.files({
            'data1.html': '<p>1</p>',
        }, function(err) {
            if (err) return done(err);
            fs.src('data2.json')
                .pipe(hbs("template.hbs"))
                .pipe(expects.files({
                    'data2.html': '<p>2</p>',
                }, function(err) {
                    if (err) return done(err);
                    try {
                        assert.strictEqual(count, 1);
                    } catch (err) {
                        return done(err);
                    }
                    done();
                }));
        }));
});

it('should deal with slow readFile', function(done) {
    function InterceptFs() { };
    InterceptFs.prototype = fs;
    var interceptFs = new InterceptFs();
    var readCb = null;
    interceptFs.readFile = function(name, encoding, cb) {
        assert.strictEqual(readCb, null);
        assert(encoding === "utf-8");
        assert.strictEqual(name, "template.hbs");
        readCb = cb;
    };
    var hbs = rewire('../');
    hbs.__set__("fs", interceptFs);
    var fs = mockfs({
        'data1.json': '{"content":1}',
        'data2.json': '{"content":2}',
    });
    fs.src('data1.json')
        .pipe(hbs("template.hbs"))
        .pipe(expects.files({
            'data1.html': '<p>1</p>',
        }, done));
    setTimeout(function() {
        if (!readCb) done(Error("Expected one read by this time"));
        readCb(null, '<p>{{content}}</p>');
    }, 20);
});

it('should read the same file concurrently', function(done) {
    function InterceptFs() { };
    InterceptFs.prototype = fs;
    var interceptFs = new InterceptFs();
    var readCb = null;
    interceptFs.readFile = function(name, encoding, cb) {
        assert.strictEqual(readCb, null); // also ensures just a single call
        assert(encoding === "utf-8");
        assert.strictEqual(name, "template.hbs");
        readCb = cb;
    };
    var hbs = rewire('../');
    hbs.__set__("fs", interceptFs);
    var fs = mockfs({
        'data1.json': '{"content":1}',
        'data2.json': '{"content":2}',
    });
    mergeStream(
        fs.src('data1.json')
            .pipe(hbs("template.hbs")),
        fs.src('data2.json')
            .pipe(hbs("template.hbs")))
        .pipe(expects.files({
            'data1.html': '<p>1</p>',
            'data2.html': '<p>2</p>',
        }, done));
    setTimeout(function() {
        if (!readCb) done(Error("Expected one read by this time"));
        readCb(null, '<p>{{content}}</p>');
    }, 20);
});

it('cooperates with gulp-dox', function(done) {
    var fs = mockfs({
        'source.js': '/** Foo */\nfunction foo(){}\n\n' +
            '/** Bar */\nfunction bar(){}',
        'template.hbs': '<ul>{{#each .}}<li>' +
            '{{{description.summary}}}</li>{{/each}}</ul>',
    });
    fs.src('*.js')
        .pipe(require('gulp-dox')())
        .pipe(hbs(fs.src('*.hbs')))
        .pipe(expects.singleFile(
            'source.html',
            '<ul><li><p>Foo</p></li><li><p>Bar</p></li></ul>',
            done));
});

it('cooperates with markit-json', function(done) {
    var fs = mockfs({
        'file.md': '---\nattr: value\n---\n*body*',
        'template.hbs': '<p>{{attr}}</p><hr>{{{body}}}',
    });
    fs.src('*.md')
        .pipe(require('markit-json')())
        .pipe(hbs(fs.src('*.hbs')))
        .pipe(expects.singleFile(
            'file.html',
            '<p>value</p><hr><p><em>body</em></p>',
            done));
});

it('cooperates with gulp-font-matter in vinyl mode', function(done) {
    var fs = mockfs({
        'file.html': '---\nattr: value\n---\n<p>body</p>',
        'template.hbs': '<p>{{frontMatter.attr}}</p><hr>{{{body}}}',
    });
    fs.src('*.html')
        .pipe(require('gulp-front-matter')())
        .pipe(hbs(fs.src('*.hbs'), {dataSource: 'vinyl'}))
        .pipe(expects.singleFile(
            'file.html',
            '<p>value</p><hr><p>body</p>',
            done));
});

it('cooperates with gulp-font-matter in data mode', function(done) {
    var fs = mockfs({
        'file.html': '---\ntemplate: template1.hbs\n---\nbody',
        'template1.hbs': '<p>{{{body}}}</p>',
        'template2.hbs': '<pre>{{{body}}}</pre>',
    });
    fs.src('*.html')
        .pipe(require('gulp-front-matter')({property: 'data'}))
        .pipe(hbs(fs.src('*.hbs'), {dataSource: 'data'}))
        .pipe(expects.singleFile('file.html', '<p>body</p>', done));
});

it('cooperates with gulp-data', function(done) {
    var fs = mockfs({
        'file.html': '<p>body</p>',
        'template.hbs': '<p>{{data.attr}}</p><hr>{{{body}}}',
    });
    fs.src('*.html')
        .pipe(require('gulp-data')(function(file) { return {attr: 'value'}; }))
        .pipe(hbs(fs.src('*.hbs'), {dataSource: 'vinyl'}))
        .pipe(expects.singleFile(
            'file.html',
            '<p>value</p><hr><p>body</p>',
            done));
});

it('can be isolated', function(done) {
    var fs = mockfs({
        'file.json': '{"index":1}',
        'template.hbs': '{{foo}} {{index}}',
    });
    var instance = hbs.handlebars.create();
    instance.registerHelper('foo', function() { return 'bar'; });
    fs.src('*.json')
        .pipe(require('gulp-data')(function(file) { return {attr: 'value'}; }))
        .pipe(hbs(fs.src('*.hbs'), {compile: instance.compile.bind(instance)}))
        .pipe(expects.singleFile('file.html', 'bar 1', done));
});
