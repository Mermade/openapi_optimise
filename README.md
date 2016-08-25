# openapi_optimise

A utility to optimise OpenApi (swagger) 2.0 specifications, by

* Converting repeated parameters into common parameters
* Removing duplicated common parameters
* Removing unused common parameters
* Removing redundant consumes/produces

It may be most useful when the OpenApi specification has been converted from another format.
