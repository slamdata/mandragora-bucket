var _ = require("underscore"),
    gulp = require("gulp"),
    purescript = require("gulp-purescript"),
    concat = require("gulp-concat"),
    sequence = require("run-sequence"),
    rename = require("gulp-rename"),
    coveralls = require("gulp-coveralls"),
    
    br = require("browserify"),
    source = require("vinyl-source-stream"),
    buffer = require("vinyl-buffer"),

    karma = require("karma").server;


var defaults = require("./lib/defaults.js"),
    runnerFactory = require("./lib/runner.js"),
    errorHandler = require("./lib/handle-error.js"),
    nameGetter = require("./lib/get-names.js"),
    istanbullify = require("./lib/istanbullify.js"),
    serve = require("./lib/serve.js");

function defineTasks(config) {
    var paths = _.extend(defaults.paths, config.paths),
        names = _.mapObject(defaults.names, function(val, key) {
            if (config.prefix) {
                return prefix + val;
            }
            return val;
        });

    gulp.task(names.serve, serve());
    gulp.task(names.baseRunner, function() {
        runnerFactory.main();
    });
    gulp.task(names.testRunner, function() {
        var modules = nameGetter.modules(paths.src);
        runnerFactory.test("test.js", "Test.Main", modules, paths.dest.dist);
    });
    gulp.task(names.runner, ["base-runner", "test-runner"]);
    gulp.task(names.docs, function() {
        var docgen = purescript.pscDocs();
        errorHandler(docgen);
        return gulp.src(paths.docs.src)
            .pipe(docgen)
            .pipe(gulp.dest(paths.docs.dest));
    });
    gulp.task(names.psci, function() {
        gulp.src(
            paths.src.concat(paths.bower).concat(paths.test)
        ).pipe(purescript.dotPsci({}));
    });
    gulp.task(names.copyNpm, function() {
        return gulp.src(["node_modules/**/*"])
            .pipe(gulp.dest(paths.dest.dist + "/" + paths.dest.npm));
    });
    gulp.task(names.makeProd, function() {
        var psc = purescript.psc({
            output: paths.dest.out.build,
            modules: ["Main"],
            main: "Main"
        });
        errorHandler(psc);
        return gulp.src(paths.src.concat(paths.bower))
            .pipe(psc)
            .pipe(gulp.dest(paths.dest.dist));
    });
    gulp.task(names.makeDev, function() {
        var psc = purescript.pscMake({
            output: paths.dest.dist + "/" + paths.dest.npm
        });
        errorHandler(psc);
        return gulp.src(paths.src.concat(paths.bower).concat(paths.test))
            .pipe(psc);
    });

    var bundleIt = function(entry) {
        return function() {
            var bundler = br({
                entries: [entry]
            });
            var bundle = function() {
                return bundler
                    .bundle()
                    .pipe(source(paths.dest.out.build))
                    .pipe(buffer())
                    .pipe(gulp.dest(paths.dest.dist));
            };
            return bundle();
        };
    };

    gulp.task(names.bundleDev, [names.makeDev],
              bundleIt("./" + paths.dest.entry.build));

    gulp.task(names.bundleProd, [names.makeProd],
              bundleIt("./" + paths.dest.dist + "/" + paths.dest.out.build));

    gulp.task(names.bundleTest, [names.makeDev], function() {
        var bundler = br({
            entries: ["./" + paths.dest.entry.test]
        });
        var pats = nameGetter.files(
            paths.src, paths.dest.dist + "/" + paths.dest.npm);
        var bundle = function() {
            return builder
                .transform(istanbullify(pats), {global: true})
                .bundle()
                .pipe(source(paths.dest.out.test))
                .pipe(buffer())
                .pipe(gulp.dest(paths.dest.dist));
        };
        return bundle();
    });

    gulp.task(names.karma, function(cb) {
        karma.start({
            configFile: __dirname + "/karma.conf.js",
            action: "run",
            singleRun: true
        }, cb);
    });
    gulp.task(names.karmaWatch, function(cb) {
        karma.start({
            configFile: __dirname + "/karma.conf.js",
            action: "run"
        }, cb);
    });

    gulp.task(names.cover, function() {
        gulp.src("./coverage/**/lcov.info")
            .pipe(coveralls());
    });
    gulp.task(names.concatBuild, [names.bundleDev], function() {
        gulp.src(paths.concat.concat([paths.dest.dist + "/" + paths.dest.out.build]))
            .pipe(concat(paths.dest.out.concated))
            .pipe(gulp.dest(paths.public));
    });

    gulp.task(names.testDev, function(cb) {
        sequence(
            names.makeDev,
            names.bundleTest,
            cb
        );
    });
    gulp.task(names.test, function(cb) {
        sequence(
            names.copyNpm,
            names.runner,
            names.testDev,
            names.karma,
            names.cover
        );
    });
    gulp.task(names.prod, function(cb) {
        sequence(
            names.copyNpm,
            names.makeProd,
            names.bundelProd,
            names.concatBuild,
            cb
        );
    });
    gulp.task(names.compileDev, [names.runner, names.makeDev, names.bundleDev]);

    gulp.task(names.watchDev, function() {
        gulp.watch(
            paths.src.concat(paths.test),
            [names.compileDev, names.concatBuild, names.docs]
        );
    });
    gulp.task(names.watchTest, function() {
        gulp.watch(
            paths.src.concat(paths.test),
            [names.testDev]
        );
    });
    gulp.task(names.dev, [
        names.copyNpm,
        names.runner,
        names.compileDev,
        names.concatBuild,
        names.serve,
        names.watchDev
    ]);
    gulp.task(names.tdd, [
        names.copyNpm,
        names.runner,
        names.testDev,
        names.serve,
        names.watchTest
    ]);
              
}

module.exports = {
    names: defaults.names,
    paths: defaults.paths,
    define: defineTasks
};


