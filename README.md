# openapi_optimise

A set of utility functions to optimise OpenApi (swagger) 2.0 specifications

These optimisations may be most useful when the OpenApi specification has been converted from another format or
automatically generated, and may improve code-generation. Disk/over-the-wire savings of 25% *even after gzip compression* are easily possible.

## Default optimisations

* Converting repeated parameters into common parameters
* Removing duplicated common parameters
* Removing unused common parameters
* Promotion of repeated mandatory action-level parameters to path-level
* Removal of redundant parameter default properties
* Removing redundant consumes/produces
* Compression of different representations of functionally equivalent empty schemas
* Removing unused and empty tags 
* Removing empty definitions
* Removing empty responses
* Using tabs for indenting the output if serialised by the included utilities
* Using UTF8 encoding for the output if serialised by the included utilities

## Not enabled by default are

* Optional expansion of all *local* non-circular $ref's prior to
* Automatic creation of $ref's for repeated model elements

As these currently consume excessive memory or have not been sufficiently tested

## TODO

* Tidy-up logging to console, controlled by a verbosity option

## Included command-line tools

* `openapi_optimise` applies all default optimisations

````
openapi_optimise {infile} [{outfile}]

Options:
  -h, --help        Show help                                          [boolean]
  -v, --verbose     verbosity level, repeat for more logging             [count]
  -n, --nondefault  apply non-default operations                       [boolean]
  -e, --expand      expand all local $refs before any model compression[boolean]
  -d, --deindent    no indentation/linefeeds                           [boolean]
  -y, --yaml        read and write specification in yaml format (default JSON)
                                                                       [boolean]
  -i, --yamlinput   read specification in yaml format                  [boolean]
  -o, --yamloutput  write specification in yaml format                 [boolean]
````
