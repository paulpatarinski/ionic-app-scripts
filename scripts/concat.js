var path = require('path');
var q = require('q');
var vinylFs = require('vinyl-fs');
var vinylConcat = require('vinyl-fs-concat');
var program = require('commander');
var srcDirPath  = path.join(__dirname, '..', 'src');
var destDirPath = path.join(__dirname, '..', 'www', 'build');
var paths = {
    scripts:{
        src : [srcDirPath + "/**/*"],
        dest : 'main.concat.js'
    }
};

program
  .option('-i, --inlineSrcMap', 'Generate the source maps inline')
  .parse(process.argv);

function logExecTime(startTime, msg) {
  var hrend = process.hrtime(startTime);
  console.info("%s %ds %dms", msg, hrend[0], hrend[1] / 1000000);
}

function concatAppScripts() {
  var deferred = q.defer();
  var startTime = process.hrtime();
  var srcMapOpt = program.inlineSrcMap ? { sourcemaps: true } : {
    sourcemaps: {
      path: '.',
      sourceRoot: ''
    }
  };

  vinylFs.src(paths.scripts.src, { sourcemaps: true })
    .pipe(vinylConcat(paths.scripts.dest))
    .pipe(vinylFs.dest(destDirPath, srcMapOpt))
    .on('finish', function () {
      logExecTime(startTime, 'Concat app scripts in');
      deferred.resolve();
    })
    .on('error', function (err) {
      deferred.reject(err);
    })

  return deferred.promise;
}

 concatAppScripts()
  .then(() => { return console.log('\nAll ur JS is now Concatenated...'); })
  .catch(() => { process.exitCode = 1; })