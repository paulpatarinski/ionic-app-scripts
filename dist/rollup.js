"use strict";
var interfaces_1 = require('./util/interfaces');
var errors_1 = require('./util/errors');
var config_1 = require('./util/config');
var ionic_rollup_resolver_plugin_1 = require('./rollup/ionic-rollup-resolver-plugin');
var path_1 = require('path');
var logger_1 = require('./logger/logger');
var rollupBundler = require('rollup');
function rollup(context, configFile) {
    configFile = config_1.getUserConfigFile(context, taskInfo, configFile);
    var logger = new logger_1.Logger('rollup');
    return rollupWorker(context, configFile)
        .then(function () {
        context.bundleState = interfaces_1.BuildState.SuccessfulBuild;
        logger.finish();
    })
        .catch(function (err) {
        context.bundleState = interfaces_1.BuildState.RequiresBuild;
        throw logger.fail(err);
    });
}
exports.rollup = rollup;
function rollupUpdate(changedFiles, context) {
    var logger = new logger_1.Logger('rollup update');
    var configFile = config_1.getUserConfigFile(context, taskInfo, null);
    return rollupWorker(context, configFile)
        .then(function () {
        context.bundleState = interfaces_1.BuildState.SuccessfulBuild;
        logger.finish();
    })
        .catch(function (err) {
        context.bundleState = interfaces_1.BuildState.RequiresBuild;
        throw logger.fail(err);
    });
}
exports.rollupUpdate = rollupUpdate;
function rollupWorker(context, configFile) {
    return new Promise(function (resolve, reject) {
        var rollupConfig = getRollupConfig(context, configFile);
        rollupConfig.dest = getOutputDest(context, rollupConfig);
        // replace any path vars like {{TMP}} with the real path
        rollupConfig.entry = config_1.replacePathVars(context, path_1.normalize(rollupConfig.entry));
        rollupConfig.dest = config_1.replacePathVars(context, path_1.normalize(rollupConfig.dest));
        addRollupPluginIfNecessary(context, rollupConfig.plugins);
        // tell rollup to use a previous bundle as its starting point
        rollupConfig.cache = cachedBundle;
        if (!rollupConfig.onwarn) {
            // use our own logger if one wasn't already provided
            rollupConfig.onwarn = createOnWarnFn();
        }
        logger_1.Logger.debug("entry: " + rollupConfig.entry + ", dest: " + rollupConfig.dest + ", cache: " + rollupConfig.cache + ", format: " + rollupConfig.format);
        // bundle the app then create create css
        rollupBundler.rollup(rollupConfig)
            .then(function (bundle) {
            logger_1.Logger.debug("bundle.modules: " + bundle.modules.length);
            // set the module files used in this bundle
            // this reference can be used elsewhere in the build (sass)
            context.moduleFiles = bundle.modules.map(function (m) {
                // sometimes, Rollup appends weird prefixes to the path like commonjs:proxy
                var index = m.id.indexOf(path_1.sep);
                if (index >= 0) {
                    return m.id.substring(index);
                }
                return m.id;
            });
            // cache our bundle for later use
            if (context.isWatch) {
                cachedBundle = bundle;
            }
            // write the bundle
            return bundle.write(rollupConfig);
        })
            .then(function () {
            // clean up any references (overkill yes, but let's play it safe)
            rollupConfig = rollupConfig.cache = rollupConfig.onwarn = rollupConfig.plugins = null;
            resolve();
        })
            .catch(function (err) {
            // ensure references are cleared up when there's an error
            cachedBundle = rollupConfig = rollupConfig.cache = rollupConfig.onwarn = rollupConfig.plugins = null;
            reject(new errors_1.BuildError(err));
        });
    });
}
exports.rollupWorker = rollupWorker;
function addRollupPluginIfNecessary(context, plugins) {
    var found = false;
    for (var _i = 0, plugins_1 = plugins; _i < plugins_1.length; _i++) {
        var plugin = plugins_1[_i];
        if (plugin.name === ionic_rollup_resolver_plugin_1.PLUGIN_NAME) {
            found = true;
            break;
        }
    }
    if (!found) {
        // always add the Ionic plugin to the front of the list
        plugins.unshift(ionic_rollup_resolver_plugin_1.ionicRollupResolverPlugin(context));
    }
}
function getRollupConfig(context, configFile) {
    configFile = config_1.getUserConfigFile(context, taskInfo, configFile);
    return config_1.fillConfigDefaults(configFile, taskInfo.defaultConfigFile);
}
exports.getRollupConfig = getRollupConfig;
function getOutputDest(context, rollupConfig) {
    if (!path_1.isAbsolute(rollupConfig.dest)) {
        // user can pass in absolute paths
        // otherwise save it in the build directory
        return path_1.join(context.buildDir, rollupConfig.dest);
    }
    return rollupConfig.dest;
}
exports.getOutputDest = getOutputDest;
function invalidateCache() {
    cachedBundle = null;
}
exports.invalidateCache = invalidateCache;
var cachedBundle = null;
function createOnWarnFn() {
    var previousWarns = {};
    return function onWarningMessage(msg) {
        if (msg in previousWarns) {
            return;
        }
        previousWarns[msg] = true;
        if (!(IGNORE_WARNS.some(function (warnIgnore) { return msg.indexOf(warnIgnore) > -1; }))) {
            logger_1.Logger.warn("rollup: " + msg);
        }
    };
}
var IGNORE_WARNS = [
    'keyword is equivalent to'
];
var taskInfo = {
    fullArg: '--rollup',
    shortArg: '-r',
    envVar: 'IONIC_ROLLUP',
    packageConfig: 'ionic_rollup',
    defaultConfigFile: 'rollup.config'
};
