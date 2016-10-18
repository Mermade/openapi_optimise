# openapi_optimise

![Build](https://img.shields.io/travis/Mermade/openapi_optimise.svg) [![Tested on APIs.guru](https://api.apis.guru/badges/tested_on.svg)](https://APIs.guru)
[![Tested on Mermade OpenAPIs](https://mermade.github.io/openapi_optimise/tested.svg)](https://github.com/mermade/openapi_specifications)

![Logo](https://mermade.github.io/openapi_optimise/logo.png)

A set of utility functions to optimise OpenApi (swagger) 2.0 specifications

These optimisations may be most useful when the OpenApi specification has been converted from another format or
automatically generated, and may improve code-generation. Differencing the input and output may also identify
errors in your specification not detected by most parsers/validators. Disk/over-the-wire savings of 25%
*even after gzip compression* are easily possible.

## Default optimisations

* Converting repeated parameters into common parameters
* Removing duplicated common parameters
* Removing unused common parameters
* Promotion of repeated mandatory action-level parameters to path-level
* Removal of redundant parameter default properties
* Removal of incorrect parameter type, property and format combinations
* Removal of redundant enums (from boolean types)
* Removing empty parameter descriptions
* Removing redundant consumes/produces
* Compression of different representations of functionally equivalent empty schemas
* Removing unused and empty tags
* Removing empty definitions
* Removing empty responses
* Removing unused securityDefinitions
* Using tabs for indenting the output if serialised as JSON by the included utility
* Using a compact yaml format if serialised as YAML by the included utility
* Using UTF8 encoding for the output if serialised by the included utility

## Not enabled by default are

* Optional expansion of all *local* non-circular $ref's prior to
* Automatic creation of $ref's for repeated model elements

As these currently consume excessive memory or have not been sufficiently tested

## Usage

````javascript
var opt = require('openapi_optimise');

var options = {};
// options.verbose = 1;
var dest = opt.defaultOptimisations(swagger,options);
````

## Included command-line tool

* `openapi_optimise` applies all safe optimisations by default

````
openapi_optimise {infile} [{outfile}]

Options:
  -h, --help           Show help                                       [boolean]
  -v, --verbose        verbosity level, repeat for more logging          [count]
  -n, --nondefault     apply non-default operations                    [boolean]
  -u, --unindent       no indentation/linefeeds                        [boolean]
  -a, --analyse        analyse structure of specification              [boolean]
  -e, --expand         expand all local $refs before any model compression
                                                                       [boolean]
  -i, --inline         inline $refs rather than moving to #/definitions[boolean]
  -j, --jsyaml         use jsyaml for output, default jgexml           [boolean]
  -s, --skip-defaults  do not perform default optimisations            [boolean]
  -t, --preserve-tags  preserve tags with vendor extensions            [boolean]
  -y, --yaml           read and write specification in yaml format (default
                       JSON)                                           [boolean]
  -r, --yamlread       read specification in yaml format               [boolean]
  -w, --yamlwrite      write specification in yaml format              [boolean]
````

## Tests

To run a test-suite:

````
node testRunner {path-to-APIs}
````

The test harness currently expects files named `swagger.yaml` or `swagger.json` and has been tested against

* [APIs.guru](https://github.com/APIs-guru/openapi-directory)
* [Mermade OpenApi specifications collection](https://github.com/mermade/openapi_specifications)

