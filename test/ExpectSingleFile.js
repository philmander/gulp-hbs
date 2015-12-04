var assert = require('assert');
var stream = require('stream');
var util = require('util');
var vinyl = require('vinyl');

module.exports = ExpectSingleFile;

function ExpectSingleFile(contents, properties, callback) {
    if (!(this instanceof ExpectSingleFile))
        return new ExpectSingleFile(contents, properties, callback);
    stream.Writable.call(this, {objectMode: true});
    this.expectedContents = contents;
    this.expectedProperties = properties;
    this.on('finish', this.verifyOnFinish.bind(this, callback));
    this.on('error', callback);
    this.filesSeen = 0;
}

util.inherits(ExpectSingleFile, stream.Writable);

ExpectSingleFile.prototype._write = function(file, encoding, callback) {
    try {
        this.verifyOnFile(file);
    } catch (err) {
        return callback(err);
    }
    return callback();
};

ExpectSingleFile.prototype.verifyOnFile = function(file) {
    assert.strictEqual(this.filesSeen, 0);
    this.filesSeen++;
    assert(vinyl.isVinyl(file));
    for (var key in this.expectedProperties)
        assert.strictEqual(this.expectedProperties[key], file[key]);
    assert(file.isBuffer());
    if (Buffer.isBuffer(this.expectedContents)) {
        assert(this.expectedContents.equals(file.contents));
    } else {
        assert.strictEqual(
            file.contents.toString().trim(),
            this.expectedContents.trim());
    }
};

ExpectSingleFile.prototype.verifyOnFinish = function(callback) {
    try {
        assert.strictEqual(this.filesSeen, 1);
    } catch (err) {
        return callback(err);
    }
    return callback();
};
