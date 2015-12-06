'use strict';

var through = require('through2');
var gutil = require('gulp-util');
var fs = require('fs');
var Handlebars = require('handlebars');
var PluginError = gutil.PluginError;

var globalCache = {};

var PLUGIN_NAME = 'gulp-hbs';

function pluginError(msg) {
    return new gutil.PluginError(PLUGIN_NAME, msg);
}

const THE_ONLY_TEMPLATE = {};

function gulpHbs(templateSrc, options) {

    options = options || {};
    var cache = options.cache || globalCache;
    if (options.cache === true) cache = globalCache;
    if (options.cache === false) cache = {};
    var defaultTemplateName = options.defaultTemplate || THE_ONLY_TEMPLATE;
    var dataSource = options.dataSource || 'json';
    var bodyAttribute = options.bodyAttribute || 'body';
    var templateAttribute = options.templateAttribute || 'template';
    templateAttribute = templateAttribute.split('.');
    var compile = options.compile || Handlebars.compile;

    var registry = {};
    var registryComplete = false;
    var currentJob = false;
    var currentError = null;
    var forcedTemplateName = null;

    if (dataSource === 'json') {
        dataSource = function(file) {
            return JSON.parse(file.contents.toString());
        };
    } else if (dataSource === 'vinyl') {
        dataSource = function(file) {
            file[bodyAttribute] = file.contents.toString();
            return file;
        };
    } else if (dataSource === 'data') {
        dataSource = function(file) {
            var data = file.data;
            data[bodyAttribute] = file.contents.toString();
            return data;
        };
    } else if (typeof dataSource !== 'function') {
        throw pluginError('Unknown dataSource');
    }

    if (typeof templateSrc === 'object' && templateSrc.pipe) {

        // template source is a gulp stream
        templateSrc.on('data', function(file) {
            try {
                if (!file.isBuffer())
                    throw pluginError('Template sources must be buffers');
                registry[file.relative] =
                    compile(file.contents.toString('utf-8'));
            } catch(err) {
                reportAsyncError(err);
            }
        }).on('end', function() {
            registryComplete = true;
            resumeJob();
        }).on('error', reportAsyncError);

    } else if (typeof templateSrc === 'string') {

        // template source is a file name
        forcedTemplateName = 'default';
        if (!cache.hasOwnProperty(templateSrc)) {
            // Have to read this template for the first time
            var waiting = cache[templateSrc] = [];
            fs.readFile(templateSrc, 'utf-8', function(err, data) {
                if (err) {
                    // Report the same error to all other waiting instances
                    waiting.forEach(function(cb) {
                        cb(err, null);
                    });
                    delete cache[templateSrc];
                    return reportAsyncError(err);
                }
                registry.default = cache[templateSrc] =
                    Handlebars.compile(data);
                // Release all waiting instances
                waiting.forEach(function(cb) {
                    cb(null, registry.default);
                });
                registryComplete = true;
                resumeJob();
            });
        } else if (typeof cache[templateSrc] !== 'function') {
            // Template is already being read, so wait for that
            cache[templateSrc].push(function(err, template) {
                if (err) return reportAsyncError(err);
                registry = {
                    'default': template
                };
                registryComplete = true;
                resumeJob();
            });
        } else {
            registry = {
                'default': cache[templateSrc]
            };
            registryComplete = true;
        }

    } else {
        throw pluginError('Need a template!');
    }

    function reportAsyncError(err) {
        if (currentError !== null) return;
        currentError = err;
        resumeJob();
    }

    function resumeJob() {
        if (!currentJob) return;
        process.nextTick(currentJob);
        currentJob = null;
    }

    function processData(file, data, templateName, cb) {
        if (currentError) {
            // If there was an error with our template inputs,
            // report it here so it ends up in the regular pipeline.
            var errorToReport = currentError;
            currentError = null;
            return cb(currentError);
        }
        var template;
        try {
            if (templateName === THE_ONLY_TEMPLATE) {
                var keys = Object.keys(registry);
                if (keys.length !== 1)
                    throw pluginError(
                        'Must select one specific template');
                template = registry[keys[0]];
            } else {
                if (!registry.hasOwnProperty(templateName))
                    throw pluginError(
                        'Template ' + templateName + ' not prepared');
                template = registry[templateName];
            }
            var result = template(data);
            file.path = gutil.replaceExtension(file.path, '.html');
            file.contents = new Buffer(result, 'utf-8');
            return cb(null, file);
        } catch (err) {
            return cb(err);
        }
    }

    function getTemplateName(data) {
        for (var i = 0; i < templateAttribute.length; ++i) {
            if (!data) return null;
            data = data[templateAttribute[i]];
        }
        return data;
    }

    function processFile(file, cb) {
        var data = dataSource(file);
        var templateName = forcedTemplateName
            || getTemplateName(data)
            || defaultTemplateName;
        if (registryComplete) {
            processData(file, data, templateName, cb);
        } else if (currentJob) {
            throw pluginError('Cannot deal with multiple jobs at once');
        } else {
            currentJob = processData.bind(null, file, data, templateName, cb);
        }
    }

    return through.obj(function (file, enc, cb) {
        if (file.isNull()) {
            return cb(null, file);
        }
        if (file.isBuffer()) {
            file.path = gutil.replaceExtension(file.path, '.xyz');
            try {
                processFile(file, cb);
                return;
            } catch (err) {
                return cb(err);
            }
        }
        if (file.isStream()) {
            return cb(pluginError('Streaming not supported'));
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
