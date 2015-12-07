'use strict';

var through = require('through2');
var gutil = require('gulp-util');
var fs = require('fs');
var Promise = require('bluebird').Promise;
var Handlebars = require('handlebars');
var PluginError = gutil.PluginError;

var globalCache = {};

var PLUGIN_NAME = 'gulp-hbs';

function pluginError(msg) {
    return new gutil.PluginError(PLUGIN_NAME, msg);
}

var THE_ONLY_TEMPLATE = {};

function Deferred() {
    var deferred = this;
    deferred.promise = new Promise(function(resolve, reject) {
        deferred.resolve = resolve;
        deferred.reject = reject;
    });
    deferred.promise.suppressUnhandledRejections();
}

function gulpHbs(templateSrc, options) {

    // Handle configuration options
    options = options || {};
    var cache = options.cache || globalCache;
    if (options.cache === true) cache = globalCache;
    if (options.cache === false) cache = {};
    var defaultTemplateName = options.defaultTemplate || THE_ONLY_TEMPLATE;
    var dataSource = chooseDataSource(options.dataSource || 'json');
    var bodyAttribute = options.bodyAttribute || 'body';
    var templateAttribute = options.templateAttribute || 'template';
    templateAttribute = templateAttribute.split('.');
    var compile = options.compile || Handlebars.compile;

    // Some instance-level variables
    var registry = {};
    var registryComplete = false;
    var forcedTemplateName = null;
    var theOnlyTemplate = new Deferred();
    var templateStreamError = null;

    // Distinguish template source argument types
    if (typeof templateSrc === 'object' && templateSrc.pipe) {
        // gutil.isStream seems to be too strict in the presence of
        // different stream implementations, so use duck typing
        templatesFromStream(templateSrc);
    } else if (typeof templateSrc === 'string') {
        templateFromFile(templateSrc);
    } else {
        throw pluginError('Need a template!');
    }

    // Process input files one at a time
    return through.obj(function (file, enc, cb) {
        if (file.isNull()) {
            cb(null, file);
        } else if (file.isBuffer()) {
            Promise.resolve(file)
                .then(processFile)
                .done(function(file) { cb(null, file); },
                      function(err) { cb(err, null); });
        } else if (file.isStream()) {
            cb(pluginError('Streaming not supported'));
        } else {
            cb(pluginError('Unsupported file contents type'));
        }
    });

    // Return a function to turn a file object into a JSON-like data object
    function chooseDataSource(dataSource) {
        if (dataSource === 'json') {
            return function(file) {
                return JSON.parse(file.contents.toString());
            };
        } else if (dataSource === 'vinyl') {
            return function(file) {
                file[bodyAttribute] = file.contents.toString();
                return file;
            };
        } else if (dataSource === 'data') {
            return function(file) {
                var data = file.data;
                data[bodyAttribute] = file.contents.toString();
                return data;
            };
        } else if (typeof dataSource === 'function') {
            return dataSource;
        } else {
            throw pluginError('Unknown dataSource');
        }
    }

    // Read templates from a gulp stream
    function templatesFromStream(templateStream) {
        var firstTemplate = null;
        templateStream.on('data', function(file) {
            var relpath = file.relative;
            var deferred;
            if (registry.hasOwnProperty(relpath)) {
                deferred = registry[relpath];
            } else {
                deferred = registry[relpath] = new Deferred();
            }
            try {
                if (!file.isBuffer())
                    throw pluginError('Template source must be buffer');
                var template = compile(file.contents.toString());
                deferred.resolve(template);
                if (firstTemplate === null) {
                    firstTemplate = template;
                } else {
                    firstTemplate = false;
                    theOnlyTemplate.reject(pluginError(
                        'Multiple templates given, must select one'));
                }
            } catch(err) {
                deferred.reject(err);
            }
        }).on('end', function() {
            if (firstTemplate)
                theOnlyTemplate.resolve(firstTemplate);
            else
                theOnlyTemplate.reject(pluginError(
                    'No templates in template stream'));
            noMoreTemplates();
        }).on('error', function(err) {
            templateStreamError = err;
            noMoreTemplates();
        });
    }

    // Indicate that there will be no more incoming templates
    function noMoreTemplates() {
        registryComplete = true;
        // Reject all unresolved promises
        Object.keys(registry).forEach(function(templateName) {
            registry[templateName].reject(noSuchTemplate(templateName));
        });
        theOnlyTemplate.reject(noSuchTemplate('<default>'));
    }

    // Generate a suitable error to indicate the absence of a given template
    function noSuchTemplate(templateName) {
        return templateStreamError || pluginError(
            'Template ' + templateName + ' not in source stream');
    }

    // Read single template from a file using the given file name
    function templateFromFile(path) {
        // template source is a file name
        forcedTemplateName = 'singleton';
        if (cache.hasOwnProperty(templateSrc)) {
            registry.singleton = cache[templateSrc];
            return;
        }
        // Have to read this template for the first time
        var deferred = cache[templateSrc] = registry.singleton = new Deferred();
        fs.readFile(templateSrc, 'utf-8', function(err, data) {
            try {
                if (err) throw err;
                var template = compile(data);
                deferred.resolve(template);
            } catch (err2) {
                // delete cache[templateSrc]; // Should we do this?
                deferred.reject(err2);
            }
        });
    }

    // Process one input file, may return a promise or throw an exception
    function processFile(file, cb) {
        var data = dataSource(file);
        return pickTemplate(
            forcedTemplateName
                || getTemplateName(data)
                || defaultTemplateName)
            .then(function(template) {
                var result = template(data);
                file.path = gutil.replaceExtension(file.path, '.html');
                file.contents = new Buffer(result, 'utf-8');
                return file;
            });
    }

    // Choose template for the given template name; returns a promise
    function pickTemplate(templateName) {
        if (templateName === THE_ONLY_TEMPLATE)
            return theOnlyTemplate.promise;
        if (registry.hasOwnProperty(templateName))
            return registry[templateName].promise;
        if (registryComplete)
            throw noSuchTemplate(templateName);
        return (registry[templateName] = new Deferred()).promise;
    }

    // Obtain template name from data, allowing for nested attributes
    function getTemplateName(data) {
        for (var i = 0; i < templateAttribute.length; ++i) {
            if (!data) return null;
            data = data[templateAttribute[i]];
        }
        return data;
    }
}

gulpHbs.registerHelper = function(name, helper) {
    Handlebars.registerHelper(name, helper);
};

gulpHbs.registerPartial = function(name, partial) {
    Handlebars.registerPartial(name, partial);
};

gulpHbs.handlebars = Handlebars;

// Exporting the plugin main function
module.exports = gulpHbs;
