var through = require('through2');
var gutil = require('gulp-util');
var fs = require('fs');
var Handlebars = require('handlebars');
var PluginError = gutil.PluginError;

var templates = {};

const PLUGIN_NAME = 'gulp-hbs';

function gulpHbs(templateSrc) {

    if (!templateSrc) {
        throw new PluginError(PLUGIN_NAME, 'Need a template!');
    }

    if (!templates[templateSrc]) {
        try {
            var templateText = fs.readFileSync(templateSrc, 'utf-8');
            templates[templateSrc] = Handlebars.compile(templateText);
        }
        catch (err) {
            throw new gutil.PluginError('gulp-hbs', err);
        }
    }

    return through.obj(function (file, enc, cb) {

        if (file.isNull()) {
            cb(null, file);
        }
        if (file.isBuffer()) {
            var json = file.contents.toString();
            var data = JSON.parse(json);
            var result = templates[templateSrc](data);

            file.path = gutil.replaceExtension(file.path, '.html');
            file.contents = new Buffer(result, 'utf-8');
        }
        if (file.isStream()) {
            return cb(new gutil.PluginError('gulp-hbs', 'Streaming not supported'));
        }

        cb(null, file);

    });
}

gulpHbs.registerHelper = function(name, helper) {
    Handlebars.registerHelper(name, helper);
};

gulpHbs.registerPartial = function(name, partial) {
    Handlebars.registerPartial(name, partial);
};

// Exporting the plugin main function
module.exports = gulpHbs;