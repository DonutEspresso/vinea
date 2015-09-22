# vinea

[![NPM Version](https://img.shields.io/npm/v/vinea.svg)](https://npmjs.org/package/vinea)
[![Build Status](https://travis-ci.org/DonutEspresso/vinea.svg?branch=master)](https://travis-ci.org/DonutEspresso/vinea)
[![Coverage Status](https://coveralls.io/repos/DonutEspresso/vinea/badge.svg?branch=master)](https://coveralls.io/r/DonutEspresso/vinea?branch=master)
[![Dependency Status](https://david-dm.org/DonutEspresso/vinea.svg)](https://david-dm.org/DonutEspresso/vinea)
[![devDependency Status](https://david-dm.org/DonutEspresso/vinea/dev-status.svg)](https://david-dm.org/DonutEspresso/vinea#info=devDependencies)
[![bitHound Score](https://www.bithound.io/github/DonutEspresso/vinea/badges/score.svg)](https://www.bithound.io/github/DonutEspresso/vinea/master)
[![NSP Status](https://img.shields.io/badge/NSP%20status-vulnerabilities%20found-red.svg)](https://travis-ci.org/DonutEspresso/vinea)

> find files and paths using node.js `require` semantics

This module contains various functions to help you find paths and files using
Node.js' `require` semantics.

Vinea is the latin word for vine.

## Getting Started

Install the module with: `npm install vinea`

### API

Vinea provides various functions to help with inspecting the fs, or to help
with inspecting the require paths being used by modules.

#### file system introspection

#### findItem(itemName, itemType, currentPath, recursive, callback)

Find an item on the file system starting from the current path. If recursive is
true, will continue walking up parent directories looking for the itemName.

* `itemName` {String} - name of the item to look for
* `itemType` {String} - file or directory
* `currentPath` {String} - directory to start looking in
* `recursive` {Boolean} - if true, walks up parent dir if item is not found
* `callback` {Function}

**Returns:** {String} the path of the found item


#### findParentPath(path1, path2)

Find the common parent directory between two given directories.

* `path1` {String} - a directory
* `path2` {String} - another directory

**Returns:** {String} the common parent directory between both


#### findNodeModulesPath(currentPath, callback)

Finds the nearest node_modules directory from the given directory. If not found
in current directory, walks up the parent dir until it finds it.

* `currentPath` {String} - directory to start looking in
* `callback` {Function}

**Returns:** {String} the location of the nearest node_modules directory.


#### findNodeModulePath(currentPath, moduleName, callback)

Given a module name like 'lodash', looks for a node_modules/lodash starting from
the current directory. If none is found, walks up the parent dir until it finds
one.

* `currentPath` {String) - directory to start looking in
* `moduleName` {String} - the name of the module to find
* `callback` {Function}

**Returns:** {String} the path to the module on the file system


#### findNodeModuleMainEntry(modulePath, callback)

Given a path to a node_modules module, i.e., /Users/me/project/node_modules/lodash,
this function finds the main entry point suitable for client side usage.

This function attempts to return the `browser` attribute from package.json if
available, falling back on `main` and then `index.js`.

* `modulePath` {String} - location of the module
* `callback` {Function}

**Returns:** {String} entry point value from package.json


#### findPackageJson(currentPath, callback)

Finds the location of the the nearest package.json. If it can't find package.json
in the current directory, walkis up the parent dir until it finds it.

* `currentPath` {String} - directory to start looking in.
* `callback` {Function}


#### openPackageJson(currentPath, callback)

Returns the contents of the nearest package.json. If it can't find package.json
in the current directory, walkis up the parent dir until it finds it.

* `currentPath` {String} - directory to start looking in
* `callback` {Function}

**Returns:** {Object} JSON.parsed() contents of package.json


#### findWithRequireSemantics(currentPath, item, callback)

Finds the location of a require() dependency. i.e., require('a/b') can resolve
to either b.js, or b/index.js.

* `currentPath` {String} - directory to start looking in
* `item` {String} - the require dependency
* `callback` {Function}

**Returns:** {Object} contains a `foundPath` and `statInfo` attributes


#### openWithRequireSemantics(currentPath, callback)

Finds the location of a require() dependency. i.e., require('a/b') can resolve
to either b.js, or b/index.js.

* `currentPath` {String} - directory to start looking in
* `item` {String} - the require dependency
* `callback` {Function}

**Returns:** {Object} contains `foundPath`, `statInfo`, and `contents` attributes


#### require() dependency introspection

#### getModuleNameFromPath(path)

Given a filepath with, attempt to find a node_module in the path.
i.e., /app/node_modules/lodash => lodash
      /app/node_modules/lodash/node_modules/foo => foo

* `path` {String} - a file path

**Returns:** {String} name of the module


#### hasNodeModulesInPath(path)

Returns true if a file path has `node_modules` in it.

* `path` {String} - a file path

**Returns:** {Boolean}


#### isNodeModuleRequire(requireDep)

Returns true if the require() dependency refers to a node_module.

i.e., require('lodash') => true
      require('lodash/array/map') => true
      require('./a')    => false

* `requireDep` {String}

**Returns:** {Boolean}


#### isNodeModuleMainRequire(requireDep)

Returns true if the require() dependency refers to the main entry point of a
node_module.

i.e., require('lodash') => true
      require('lodash/array/map') => false

* `requireDep` {String}

**Returns:** {Boolean}



## Contributing

Add unit tests for any new or changed functionality. Ensure that lint and style
checks pass.

To start contributing, install the git preush hooks:

```sh
make githooks
```

Before committing, run the prepush hook:

```sh
make prepush
```

If you have style errors, you can auto fix whitespace issues by running:

```sh
make codestyle-fix
```

## License

Copyright (c) 2015 Alex Liu

Licensed under the MIT license.
