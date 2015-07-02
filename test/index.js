// jscs:disable maximumLineLength

'use strict';

// core
var path     = require('path');

var chai     = require('chai');
var helpers  = require('../lib');

var assert = chai.assert;


describe('helpers', function() {

    describe('require statement introspection', function() {

        it('should identify require() calls into node_modules', function() {
            assert.equal(helpers.isNodeModuleRequire('lodash'), true);
            assert.equal(helpers.isNodeModuleRequire('lodash/array'), true);
            assert.equal(helpers.isNodeModuleRequire('lodash/array/map'), true);
            assert.equal(helpers.isNodeModuleRequire('./a'), false);
            assert.equal(helpers.isNodeModuleRequire('./a.js'), false);
            assert.equal(helpers.isNodeModuleRequire('../a'), false);
            assert.equal(helpers.isNodeModuleRequire('../a.js'), false);
            assert.equal(helpers.isNodeModuleRequire('/a'), false);
            assert.equal(helpers.isNodeModuleRequire('/a.js'), false);
        });

        it('should identify require() calls to node_module entry points', function() {
            assert.equal(helpers.isNodeModuleMainRequire('lodash'), true);
            assert.equal(helpers.isNodeModuleMainRequire('lodash/array'), false);
            assert.equal(helpers.isNodeModuleMainRequire('lodash/array/map'), false);
            assert.equal(helpers.isNodeModuleMainRequire('./a'), false);
            assert.equal(helpers.isNodeModuleMainRequire('./a.js'), false);
            assert.equal(helpers.isNodeModuleMainRequire('../a'), false);
            assert.equal(helpers.isNodeModuleMainRequire('../a.js'), false);
            assert.equal(helpers.isNodeModuleMainRequire('/a'), false);
            assert.equal(helpers.isNodeModuleMainRequire('/a.js'), false);
        });

    });

    describe('file path introspection', function() {

        it('should identify nearest parent path between two given paths', function() {
            var testDir = path.join(__dirname);
            var testSrcDir = path.join(testDir, './src');
            var moduleDir = path.join(testDir, '../');
            var buildDir = path.join(moduleDir, './build');

            assert.equal(helpers.findParentPath(buildDir, testDir), moduleDir);
            assert.equal(helpers.findParentPath(testSrcDir, testDir), testDir);
            assert.equal(helpers.findParentPath(testSrcDir, buildDir), moduleDir);

            // try with absolute paths that have identical chars after one
            // differing char.
            var parentPath = helpers.findParentPath(
                '/Users/me/Sandbox/app/bb',
                '/Users/me/Sandbox/app/ab'
            );
            assert.equal(parentPath, '/Users/me/Sandbox/app/');
        });

        it('should identify string "node_modules" is found in path', function() {
            var testDir = path.join(__dirname);
            var moduleDir = path.join(testDir, '../');
            var nodeModulesDir = path.join(moduleDir, './node_modules');

            assert.equal(helpers.hasNodeModulesInPath(testDir), false);
            assert.equal(helpers.hasNodeModulesInPath(moduleDir), false);
            assert.equal(helpers.hasNodeModulesInPath(nodeModulesDir), true);
        });

        it('should find node module name from path', function() {
            assert.equal(
                helpers.getModuleNameFromPath('/project/node_modules/lodash/array/map'),
                'lodash'
            );
            assert.equal(
                helpers.getModuleNameFromPath('/project/lodash/array/map'),
                ''
            );
            assert.equal(
                helpers.getModuleNameFromPath('/project/node_modules/lodash/node_modules/jquery'),
                'jquery'
            );
            assert.equal(
                helpers.getModuleNameFromPath('/project/node_modules/lodash/node_modules/jquery/subdir'),
                'jquery'
            );
        });

    });


    describe('file system traversal (async)', function() {
        it('should find an item in current directory', function(done) {
            var shouldPath = path.join(__dirname, '.eslintrc');

            helpers.findItem('.eslintrc', 'file', __dirname, true, function(err, foundPath) {
                assert.isNull(err);
                assert.equal(foundPath, shouldPath);
                done();
            });
        });

        it('should find an item in parent directory', function(done) {
            var shouldPath = path.join(__dirname, '../package.json');

            helpers.findItem('package.json', 'file', __dirname, true, function(err, foundPath) {
                assert.isNull(err);
                assert.equal(foundPath, shouldPath);
                done();
            });
        });

        it('should return an error when cannot find item', function(done) {

            helpers.findItem('1234567890987654321', 'file', __dirname, true, function(err, foundPath) {
                assert.ok(err);
                assert.isUndefined(foundPath);
                done();
            });
        });

        it('should find directory in current directory', function(done) {
            var shouldPath = path.join(__dirname, './src');

            // purpose tell it to look for a .dotfile that is a directory
            helpers.findItem('src', 'directory', __dirname, false, function(err, foundPath) {
                assert.isNull(err);
                assert.equal(foundPath, shouldPath);
                done();
            });
        });

        it('should find directory in parent directory', function(done) {
            var shouldPath = path.join(__dirname, '../lib');

            // purpose tell it to look for a .dotfile that is a directory
            helpers.findItem('lib', 'directory', __dirname, true, function(err, foundPath) {
                assert.isNull(err);
                assert.equal(foundPath, shouldPath);
                done();
            });
        });

        it('should return an error when cannot find directory', function(done) {
            // give it a garbage
            helpers.findItem('.1234567890987654321', 'directory', __dirname, true, function(err, foundPath) {
                assert.ok(err);
                assert.isUndefined(foundPath);
                done();
            });
        });

        it('should not find package.json (no recurse)', function(done) {
            helpers.findItem('package.json', 'file', __dirname, false, function(err, foundPath) {
                assert.ok(err);
                assert.isUndefined(foundPath);
                done();
            });
        });
    });

    describe('node.js specific file traversal', function() {

        it('should find the node_modules directory', function(done) {
            var shouldPath = path.join(__dirname, '../node_modules');

            helpers.findNodeModulesPath(__dirname, function(err, foundPath) {
                assert.isNull(err);
                assert.equal(foundPath, shouldPath);
                done();
            });
        });

        it('should find the node_modules/{module} directory', function(done) {
            var shouldPath = path.join(__dirname, '../node_modules/mocha');

            helpers.findNodeModulePath(__dirname, 'mocha', function(err, foundPath) {
                assert.isNull(err);
                assert.equal(foundPath, shouldPath);
                done();
            });
        });

        it('should find package.json location', function(done) {
            var shouldPath = path.join(__dirname, '../package.json');

            helpers.findPackageJson(__dirname, function(err, foundPath) {
                assert.isNull(err);
                assert.equal(foundPath, shouldPath);
                done();
            });
        });

        it('should return package.json contents', function(done) {

            helpers.openPackageJson(__dirname, function(err, pkgJson) {
                assert.isNull(err);
                assert.isObject(pkgJson);
                assert.equal(pkgJson.name, 'vinea');
                assert.equal(pkgJson.main, 'lib/index.js');
                done();
            });
        });

        it('should require() a file using file system path', function(done) {
            var pkgJsonPath = path.join(__dirname, '../package.json');

            helpers.tryRequire(pkgJsonPath, function(err, pkgJson) {
                assert.isNull(err);
                assert.isObject(pkgJson);
                assert.equal(pkgJson.name, 'vinea');
                assert.equal(pkgJson.main, 'lib/index.js');
                done();
            });
        });

        it('should return an error when require() a bad file', function(done) {
            var bogusPath = path.join(__dirname, '../bogus/path');

            helpers.tryRequire(bogusPath, function(err, nothing) {
                assert.ok(err);
                assert.isUndefined(nothing);
                done();
            });
        });
    });

    describe('find and open files using require() semantics', function() {

        it('should use require() semantics to find a file with extension', function(done) {
            var shouldPath = path.resolve(__dirname, 'src/a.js');

            helpers.findWithRequireSemantics(__dirname, './src/a', function(err, foundData) {
                assert.isNull(err);
                assert.equal(foundData.foundPath, shouldPath);
                assert.isObject(foundData.statInfo);
                done();
            });
        });

        it('should use require() semantics to find a file with no extension (index.js)', function(done) {
            var shouldPath = path.resolve(__dirname, 'src/index.js');

            helpers.findWithRequireSemantics(__dirname, './src', function(err, foundData) {
                assert.isNull(err);
                assert.equal(foundData.foundPath, shouldPath);
                assert.isObject(foundData.statInfo);
                done();
            });
        });

        it('should use package.json to find main entry point of a node_module', function(done) {
            var shouldModulePath = path.join(__dirname, '../node_modules/lodash');

            helpers.findNodeModulePath(__dirname, 'lodash', function(err, modulePath) {
                assert.isNull(err);
                assert.equal(modulePath, shouldModulePath);

                helpers.findNodeModuleMainEntry(modulePath, function(findErr, foundData) {
                    var shouldEntryPoint = path.join(shouldModulePath, 'index.js');

                    assert.isNull(findErr);
                    assert.equal(foundData.foundPath, shouldEntryPoint);
                    assert.isObject(foundData.statInfo);
                    done();
                });
            });
        });

        it('should use require() semantics to open a file', function(done) {
            var shouldPath = path.resolve(__dirname, 'src/a.js');

            helpers.openWithRequireSemantics(__dirname, './src/a', function(err, data) {
                assert.isNull(err);
                assert.equal(data.foundPath, shouldPath);
                assert.isObject(data.statInfo);
                assert.isString(data.contents);
                done();
            });
        });
    });

});
