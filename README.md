gulp-hbs
===========

Runs JSON files through a handlebars template, converting them to HTML

##Install

```
   npm install gulp-hbs --save-dev
```

##Usage

```js
    var hbs = require('gulp-hbs');

    gulp.src('./*.json')
        .pipe(hbs('./template.hbs')))
        .pipe(gulp.dest('./html'));
```

Useful in conjunction with tools like [Dox](https://github.com/tj/dox) for generating docs from JSON.

```js
    var dox = require('gulp-dox');
    var hbs = require('gulp-hbs');
    
    gulp.src('./src/**/*.js')
        .pipe(dox())
        .pipe(hbs('./api-template.hbs')))
        .pipe(gulp.dest('./docs'));
```

You can also use other gulp streams to describe your template(s).

```js
    var hbs = require('gulp-hbs');
    
    gulp.src('./src/**/*.js')
        .pipe(hbs(gulp.src('./templates/**/*.hbs')))
        .pipe(gulp.dest('./docs'));
```

In that case, the stram must either emit exactly one template file,
or the data must contain a `template` key which will choose among the
different templates, using their relative path as a key.

##API

###hbs(templateSrc)

templateSrc: Path to a handlebars template,
or gulp (or vinyl) stream of template files.

###hbs.registerHelper(name, helperFn);

Register a handlebars [helper](https://github.com/wycats/handlebars.js/#registering-helpers)

###hbs.registerPartial(name, partial);

Register a handlebars [partial](https://github.com/wycats/handlebars.js/#partials)

##License 

MIT © Phil Mander, Martin von Gagern
