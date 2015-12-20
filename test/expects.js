var assert = require('assert');
var stream = require('stream');
var util = require('util');
var vinyl = require('vinyl');

function ExpectStream(expectedFiles, callback) {
    stream.Writable.call(this, {objectMode: true});
    this.expectedFiles = expectedFiles;
    this.on('finish', this.verifyOnFinish.bind(this, callback));
    this.on('error', callback);
}

util.inherits(ExpectStream, stream.Writable);

ExpectStream.prototype._write = function(file, encoding, callback) {
    try {
        this.verifyOnFile(file);
    } catch (err) {
        return callback(err);
    }
    return callback();
};

ExpectStream.prototype.verifyOnFile = function(file) {
    assert(
        this.expectedFiles.hasOwnProperty(file.relative),
        "unexpected file in stream: " + file.relative);
    var expected = this.expectedFiles[file.relative];
    if (typeof expected === 'string')
        expected = { contents: expected };
    // Can't check isVinyl, see https://github.com/timnew/vinyl-fs-mock/pull/2
    //assert(vinyl.isVinyl(file), file.relative + " is not a vinyl file");
    for (var key in expected) {
        var expectedValue = expected[key];
        if (key === "contents") {
            if (Buffer.isBuffer(expectedValue)) {
                assert(
                    expectedValue.equals(file.contents),
                    "file content mismatch for " + file.relative);
            } else {
                assert.strictEqual(
                    file.contents.toString().trim(),
                    expectedValue.trim(),
                    "file content mismatch for " + file.relative);
            }
        } else {
            assert.strictEqual(
                expectedValue, file[key],
                "mismatch for property " + key + " of " + file.relative);
        }
    }
    delete this.expectedFiles[file.relative];
};

ExpectStream.prototype.verifyOnFinish = function(callback) {
    try {
        assert.strictEqual(
            Object.keys(this.expectedFiles).length, 0,
            "some expected files missing from actual stream");
    } catch (err) {
        return callback(err);
    }
    return callback();
};

module.exports.files = function(files, callback) {
    return new ExpectStream(files, callback);
};

module.exports.singleFile = function(relative, contents, properties, callback) {
    if (typeof properties === "function" && typeof callback === "undefined") {
        callback = properties;
        properties = {};
    }
    var file = {};
    for (key in properties)
        file[key] = properties[key];
    file.contents = contents;
    var files = {};
    files[relative] = file;
    return new ExpectStream(files, callback);
};
