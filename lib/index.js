'use strict';

// core
var fs           = require('fs');
var path         = require('path');

// external
var _            = require('lodash');
var vasync       = require('vasync');
var assert       = require('assert-plus');
var WError       = require('verror').WError;

// const
var NODE_MODULES = 'node_modules';
var PACKAGE_JSON = 'package.json';


//------------------------------------------------------------------------------
// helpers for use in getting more info about what's being passed into
// require() statements.
//------------------------------------------------------------------------------


/**
 * identifies if a require string is intended to target a node_module
 * require('lodash')    => true
 * require('./a')       => false
 * require('../a')      => false
 * require('/a')        => false
 * require('a.js');     => false
 * @method isNodeModuleRequire
 * @param  {String}  itemPath the string being required
 * @return {Boolean}
 */
function isNodeModuleRequire(itemPath) {
    assert.string(itemPath);

    return (itemPath !== '' &&
            !_.startsWith(itemPath, '/') &&
            !_.startsWith(itemPath, './') &&
            !_.startsWith(itemPath, '../') &&
            !_.endsWith(itemPath, '/') &&
            path.extname(itemPath) !== '.js');
}

/**
 * returns true if:
 * require('lodash')
 * returns false if:
 * require('lodash/array')
 * @method isNodeModuleMainRequire
 * @param  {String}  itemPath the string being required
 * @return {Boolean}
 */
function isNodeModuleMainRequire(itemPath) {
    assert.string(itemPath);

    // ensure path has no slashes, which indicate directory within the module
    return (itemPath !== '' &&
            itemPath.indexOf('/') === -1 &&
            path.extname(itemPath) !== '.js');
}


//------------------------------------------------------------------------------
// helpers for use in getting more info about file system paths
//------------------------------------------------------------------------------


/**
 * find the nearest parent directory between two given paths
 * @param  {String} path1 a file system path
 * @param  {String} path2 a file system path
 * @return {String}       the nearest parent directory containing both paths
 */
function findParentPath(path1, path2) {
    assert.string(path1);
    assert.string(path2);

    var matchedIdx = 0;

    // loop through each char in each path until we stop getting matches.
    _.forEach(path1, function(c, idx) { // eslint-disable-line consistent-return
        if (path2[idx] && path2[idx] === c) {
            matchedIdx++;
        } else {
            // else, break early
            return false;
        }
    });

    // slice to the matchedIdx minus one, as it's zero based index.
    var commonPath = path1.substring(0, matchedIdx);

    // ensure that the matched path ends at end of matching string or right
    // before a path separator.
    if (!(commonPath.length === path1.length ||
        commonPath.length === path2.length ||
        commonPath[commonPath.length - 1] === path.sep ||
        path1[matchedIdx + 1] === path.sep ||
        path2[matchedIdx + 1] === path.sep)) {
        // then throw away any matched characters after the last /
        commonPath = commonPath.split(path.sep)
                               .slice(0, -1)
                               .join(path.sep);
    }

    // always strip trailing slash
    if (!_.endsWith(commonPath, path.sep)) {
        commonPath += path.sep;
    }

    return commonPath;
}


/**
 * returns true if 'node_modules/' is found in the path
 * @method hasNodeModulesInPath
 * @param  {String}  itemPath a file system path
 * @return {Boolean}
 */
function hasNodeModulesInPath(itemPath) {
    assert.string(itemPath);

    return itemPath.indexOf(NODE_MODULES) > -1;
}


/**
 * returns the node_module name from the path.
 * starts via the last found node_modules occurence in the string:
 * 1) /users/bob/project/node_modules/lodash => lodash
 * 2) /users/bob/project/node_modules/lodash/node_modules/foo => foo
 * @param  {String} itemPath a file system path
 * @return {String}
 */
function getModuleNameFromPath(itemPath) {
    assert.string(itemPath);

    // find the last occurrence of 'node_modules/' in the path
    var nmPath = NODE_MODULES + '/';
    var idxSlash = itemPath.lastIndexOf(nmPath);

    // if path has node_modules in it, just return empty string
    if (idxSlash === -1) {
        return '';
    } else {
        // else, happy path, let's continue.
        // slice from the found index to end of string, including any subdirs
        // i.e., /project/node_modules/lodash/array/map =>
        //       lodash/array/map
        var modulePathFull = itemPath.slice(idxSlash + nmPath.length);

        // finally, strip off any subdirs after that
        // i.e., lodash/array/map => lodash
        //  or   jquery => jquery, if no subdirs are there
        idxSlash = modulePathFull.indexOf('/');

        if (idxSlash === -1) {
            return modulePathFull;
        } else {
            return modulePathFull.slice(0, idxSlash);
        }
    }
}


//------------------------------------------------------------------------------
// other helpers for traversing fs or getting files
//------------------------------------------------------------------------------


/**
 * find an item by the given name.
 * look in current path, go up a directory if not found.
 * recursive.
 * @param  {String}   itemName    name of the item you want to find
 * @param  {String}   itemType    'file' || 'directory'
 * @param  {String}   currentPath current file system path to start looking from
 * @param  {Boolean}  recursive   whether or not we should recurse up parent dir
 * @param  {Function} callback    callback function
 * @return {String}               path of found item
 */
function findItem(itemName, itemType, currentPath, recursive, callback) {

    assert.string(itemName, 'itemName');
    assert.string(currentPath, 'currentPath');
    assert.string(itemType, 'itemType');
    assert.bool(recursive, 'recursive');
    assert.func(callback, 'callback');

    // read in all items from current directory
    return fs.readdir(currentPath, function(readdirErr, dirItems) {
        if (readdirErr) {
            return callback(readdirErr);
        }

        // after getting all items in current directory, stat them in parallel.
        // check if they are directory or item.
        vasync.forEachParallel({
            func: function statItem(dirItem, innerCb) {

                var dirItemPath = path.join(currentPath, dirItem);

                fs.stat(dirItemPath, function(statErr, item) {
                    if (statErr) {
                        return innerCb(statErr);
                    }

                    // this is the bingo case:
                    // 1) if item matches the type we're looking for
                    // 2) item name matches
                    if (itemType === 'directory' &&
                            item.isDirectory() &&
                            dirItem === itemName) {
                        return innerCb(null, dirItemPath);
                    } else if (itemType === 'file' &&
                                item.isFile() &&
                                dirItem === itemName) {
                        return innerCb(null, dirItemPath);
                    }

                    return innerCb();
                });
            },
            inputs: dirItems
        }, function vasyncDone(err, results) {
            if (err) {
                return callback(err);
            }

            // loop through all vasync results, check if we returned a value
            // somewhere.
            var foundPath = _(results.operations)
                                .pluck('result')
                                .compact()
                                .value()
                                .shift();

            // if we found a path, return it.
            if (foundPath) {
                return callback(null, foundPath);
            } else {

                if (recursive) {
                    // if we reached root and found nothing, return an error.
                    if (currentPath === '/') {
                        return callback(
                            new Error('Traversed up to root directory, but '  +
                                            'could not find ' + itemName + '!'
                            )
                        );
                    }
                    // if we didn't find anything, and we haven't reached root yet,
                    // go up a directory and try again.
                    else if (!foundPath) {
                        return findItem(
                            itemName,
                            itemType,
                            path.join(currentPath, '..'),
                            true,
                            callback
                        );
                    }
                } else {
                    return callback(new Error('Could not find ' + itemName));
                }
            }
        });
    });
}


/**
 * Finds the node_modules path relative to the given path.
 * It will start from the current directory, then continue walking up parent
 * directories until it finds it.
 * @param  {String}   currentPath   current directory
 * @param  {Function} callback      callback function
 * @return {String}                 a file system path
 */
function findNodeModulesPath(currentPath, callback) {
    assert.string(currentPath, 'currentPath');
    assert.func(callback, 'callback');

    findItem(NODE_MODULES, 'directory', currentPath, true, callback);
}


/**
 * finds the module path for a given node_module
 * @param  {String}   currentPath the current path
 * @param  {String}   moduleName  the name of the module to load
 * @param  {Function} callback    callback function
 * @return {String}               file system path to the module directory
 */
function findNodeModulePath(currentPath, moduleName, callback) {

    assert.string(currentPath, 'currentPath');
    assert.string(moduleName, 'moduleName');
    assert.func(callback, 'callback');

    vasync.waterfall([
        function findNmPath(innerCb) {
            findItem(NODE_MODULES, 'directory', currentPath, true,
            function(findErr, nmPath) {
                if (findErr) {
                    return innerCb(new WError(findErr, 'Could not find ' +
                                          'node_module ' + moduleName));
                }
                return innerCb(null, nmPath);
            });
        },
        function statModuleDir(nmPath, innerCb) {
            var modulePath = path.join(nmPath, moduleName);
            fs.stat(modulePath, function(err) {
                if (err) {
                    return innerCb(err);
                }
                return innerCb(null, modulePath);
            });
        }
    ], function(err, modulePath) {

        if (err) {
            // if we didn't find it, recurse up the parent dir until we reach
            // root.
            if (currentPath === '/') {
                return callback(err);
            } else {
                return findNodeModulePath(
                    path.join(currentPath, '..'),
                    moduleName,
                    callback
                );
            }
        } else {
            return callback(null, modulePath);
        }
    });
}


/**
 * Finds package.json relative to given path.
 * It will start from the current directory, then continue walking up parent
 * directories until it finds it.
 * @param  {String}   currentPath   current directory
 * @param  {Function} callback      callback function
 * @return {String}                 a file system path
 */
function findPackageJson(currentPath, callback) {
    assert.string(currentPath, 'currentPath');
    assert.func(callback, 'callback');

    findItem(PACKAGE_JSON, 'file', currentPath, true, callback);
}


/**
 * gets a package json file applicable for the current path
 * @param  {String}   currentPath current directory
 * @param  {Function} callback    callback function
 * @return {Object}               a JSON.parsed() package.json
 */
function openPackageJson(currentPath, callback) {
    assert.string(currentPath, 'currentPath');
    assert.func(callback, 'callback');

    vasync.waterfall([
        function find(innerCb) {
            findPackageJson(currentPath, innerCb);
        },
        function require(pkgJsonPath, innerCb) {
            tryRequire(pkgJsonPath, innerCb);
        }
    ], callback);
}


/**
 * attempts to require in a file, returns an err if failure.
 * moved to own function so we can try catch yet maintain
 * async conventions.
 * @param  {String}   itemPath path to item to require()
 * @param  {Function} callback       callback function
 * @return {Object}
 */
function tryRequire(itemPath, callback) {
    assert.string(itemPath, 'itemPath');
    assert.func(callback, 'callback');

    var contents;

    try {
        contents = require(itemPath);
    } catch (requireErr) {
        return callback(requireErr);
    }

    return callback(null, contents);
}


/**
 * find a file using require() semantics for a given file path
 * i.e., require('a/b') resolves to => /users/bob/project/a/b,
 * this can be one of two values:
 * 1) b
 * 2) b/index.js
 * Uses fs.stat to determine existence of the file.
 * returns an error if nothing is found.
 * @method findWithRequireSemantics
 * @param  {String}   currentPath the current directory path
 * @param  {String}   item        the file to open
 * @param  {Function} callback    callback function
 * @return {String}               the path for file to be found
 * @return {Object}               fs.stat result for the found file
 */
function findWithRequireSemantics(currentPath, item, callback) {

    assert.string(currentPath, 'currentPath');
    assert.string(item, 'item');
    assert.func(callback, 'callback');

    // depending on if it's a node_module require or a file require, look it up
    // differently.
    if (isNodeModuleMainRequire(item)) {
        // 1) first scenario is a main node_module require
        // i.e., require('lodash')
        vasync.waterfall([
            // 1) find the node_modules dir.
            function findNm(innerCb) {
                findNodeModulePath(currentPath, item, innerCb);
            },
            // 2) get the main entry point
            findNodeModuleMainEntry
        ], callback);
    } else if (isNodeModuleRequire(item)) {
        // 2) requiring a file from inside a node module
        // i.e., require('lodash/array/map')
        var moduleName = item.slice(0, item.indexOf('/'));
        var secondHalf = item.replace(moduleName, '');

        vasync.waterfall([
            // 1) find the node_modules dir.
            function findNm(innerCb) {
                findNodeModulePath(currentPath, moduleName, innerCb);
            },
            // 2) get the main entry point
            function find(nmPath, innerCb) {
                var itemPath = path.join(nmPath, secondHalf);
                return findWithRequireSemantics(itemPath, '', innerCb);
            }
        ], callback);
    } else {
        // 3) requiring a file, we must try three possible files for
        //    require('./a'):
        //    a) a file called a,
        //    b) a/index.js
        //    c) a file called a.js
        //    d) it's a transpile file, a.jsx => a.js
        var currentExt = path.extname(item);
        var joinedPath = path.join(currentPath, item);
        var tryPaths = [
            // scenario a)
            path.join(currentPath, item)
        ];

        // scenario b) and c)
        // try scenario b) and c) only if the original path didn't have a
        // .js extension
        if (currentExt !== '.js') {
            tryPaths.push(path.join(joinedPath, 'index.js'));
            tryPaths.push(joinedPath + '.js');
            tryPaths.push(joinedPath + '.js');
            // in the final scenario, it might be a transpiled file, let's use
            // the same filepath, remove the extension, and try it with a .js
            // ext
            tryPaths.push(
                joinedPath.slice(0, joinedPath.lastIndexOf('.')) + '.js'
            );
        }

        // start trying them all until we find something
        vasync.forEachParallel({
            func: function tryOpen(tryPath, innerCb) {
                // if not, try to read it in now.
                fs.stat(tryPath, function(err, statItem) {

                    if (err) {
                        return innerCb(err);
                    } else if (statItem.isFile()) {
                        return innerCb(null, {
                            foundPath: tryPath,
                            statInfo: statItem
                        });
                    } else {
                        return innerCb(
                            new Error('item was not a file: ' + tryPath)
                        );
                    }
                });
            },
            inputs: tryPaths
        }, function(err, results) {  // eslint-disable-line handle-callback-err
            // it's okay to arrive here with an error, since likely one of
            // the above three failed.
            // however, if we arrived here without contents or path, it's bad!
            var successOp = _(results.operations)
                                .reject(function(op) {
                                    return op.status === 'fail';
                                })
                                .first();

            if (successOp) {
                return callback(null, successOp.result);
            } else {
                return callback(new Error('failed to find any variation of ' +
                                    currentPath + ' + ' + item));
            }
        });
    }
}


/**
 * given a file system path, attempt to open the correct version file
 * using require semantics. uses findWithRequireSemantics() to get the
 * path of the file to open.
 * returns two arguments,
 * 1) the path it was found at
 * 2) the contents of the file
 * returns an error if nothing is found.
 * @method openWithRequireSemantics
 * @param  {String}   currentPath the current path where we're opening a file
 * @param  {String}   item        a string from a require() statement
 * @param  {Function} callback    callback function
 * @return {String}   the path the file was found at
 * @return {String}   contents of the file
 * @return {Object}   fs.stat result for the found file
 */
function openWithRequireSemantics(currentPath, item, callback) {

    assert.string(currentPath, 'currentPath');
    assert.string(item, 'item');
    assert.func(callback, 'callback');

    vasync.waterfall([
        function find(innerCb) {
            findWithRequireSemantics(currentPath, item, innerCb);
        },
        function read(foundData, innerCb) {
            var foundPath = foundData.foundPath;

            fs.readFile(foundPath, function readComplete(err, contents) {
                if (err) {
                    return innerCb(err);
                }

                return innerCb(null, _.assign(foundData, {
                    contents: contents.toString()
                }));
            });
        }
    ], callback);
}


/**
 * given a path to a node_modules module,
 * i.e., /Users/bob/project/node_modules/lodash
 * finds the main entry point suitable for client side usage
 * @method findNodeModuleMainEntry
 * @param  {String}   modulePath  a file system path to the module directory
 * @param  {Function} callback    callback function
 * @return {String}               the file system path to a file
 */
function findNodeModuleMainEntry(modulePath, callback) {

    assert.string(modulePath, 'modulePath');
    assert.func(callback, 'callback');

    var moduleName = getModuleNameFromPath(modulePath);

    // otherwise, first, get package.json
    var pkgJsonPath = path.join(modulePath, 'package.json');
    var pkgJson = require(pkgJsonPath);
    var entryPointPath;

    // now, we can get the main entry point in a few ways.
    // 1) use the browser entry point if one is available
    if (typeof pkgJson.browser === 'string') {
        entryPointPath = pkgJson.browser;
    }
    // 2) use the main entry point
    else if (typeof pkgJson.main === 'string') {
        entryPointPath = pkgJson.main;
    }
    // 3) if nothing else, use index.js
    else {
        entryPointPath = 'index.js';
    }

    // check if we have a missing entry point, and return err if necessary
    if (!entryPointPath) {
        return callback(new Error('Could not find entry point: ' + moduleName));
    }

    // then find it and send it back up
    return findWithRequireSemantics(modulePath, entryPointPath, callback);
}



// fs introspection
module.exports.findItem = findItem;
module.exports.findParentPath = findParentPath;
module.exports.findNodeModulePath = findNodeModulePath;
module.exports.findNodeModulesPath = findNodeModulesPath;
module.exports.findNodeModuleMainEntry = findNodeModuleMainEntry;
module.exports.findPackageJson = findPackageJson;
module.exports.findWithRequireSemantics = findWithRequireSemantics;
module.exports.openPackageJson = openPackageJson;
module.exports.openWithRequireSemantics = openWithRequireSemantics;

// `require` path introspection
module.exports.getModuleNameFromPath = getModuleNameFromPath;
module.exports.hasNodeModulesInPath = hasNodeModulesInPath;
module.exports.isNodeModuleRequire = isNodeModuleRequire;
module.exports.isNodeModuleMainRequire = isNodeModuleMainRequire;

// other
module.exports.tryRequire = tryRequire;
