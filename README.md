gulp-hbs
===========

Runs JSON files through a handlebars template, converting them to HTML

##Install

```
   npm install gulp-hbs --save-dev
```

##Usage

```javascript
    var hbs = require('gulp-hbs');

    gulp.src('./*.json')
        .pipe(hbs('./template.hbs')))
        .pipe(gulp.dest('./html'));
```

Useful in conjunction with tools like [Dox](https://github.com/tj/dox) for generating docs from JSON.

```javascript
    var dox = require('gulp-dox');
    var hbs = require('gulp-hbs');
    
    gulp.src('./src/**/*.js')
        .pipe(dox())
        .pipe(hbs('./api-template.hbs')))
        .pipe(gulp.dest('./docs'));
```

##API

###hbs(templateSrc)

templateSrc: Path to a handlebars template

###hbs.registerHelper(name, helperFn);

Register a handlebars [helper](https://github.com/wycats/handlebars.js/#registering-helpers)

###hbs.registerPartial(name, helperFn);

Register a handlebars [partial](https://github.com/wycats/handlebars.js/#partials)

##License 

MIT © Phil Mander
