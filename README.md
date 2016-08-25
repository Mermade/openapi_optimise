# openapi_optimise

A utility to optimise OpenApi (swagger) 2.0 specifications, by

* Converting repeated parameters into common parameters
* Removing duplicated common parameters
* Removing unused common parameters
* Removing redundant consumes/produces

Not enabled by default are

* Optional expansion of all $ref's prior to
* Automatic creation of $ref's for repeated model elements

As these currently consume excessive memory

This optimisation may be most useful when the OpenApi specification has been converted from another format or
automatically generated.
