# openapi_optimise

A utility to optimise OpenApi (swagger) 2.0 specifications

These optimisations may be most useful when the OpenApi specification has been converted from another format or
automatically generated, and may improve code-generation. Size savings of 25% *even after gzip compression* are easily possible.

## Default optimisations

* Converting repeated parameters into common parameters
* Removing duplicated common parameters
* Removing unused common parameters
* Removing redundant consumes/produces
* Removing unused tags
* Using tabs for indenting the output if serialised by the included utilities
* Using UTF8 encoding for the output if serialised by the included utilities

## Not enabled by default are

* Compression of different representations of functionally equivalent empty schemas
* Optional expansion of all *local* $ref's prior to
* Automatic creation of $ref's for repeated model elements

As these currently consume excessive memory or have not been sufficiently tested

## TODO

* Removal of object types where an enum only has one value and no format etc is specified

## Included command-line tools:

* `openapi_optimise` applies all default optimisations
* `shrink` applies the currently non-default optimisations
* `expand` applies the de-referencing algorithm. May create huge output on large specifications
* `detab` simply serialises the input as a JSON object with no linefeeds or indentation
