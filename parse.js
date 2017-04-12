'use strict';

var Parser = require('tap-parser');
var util = require('util');
var p = new Parser({passes: true}, function (results) {
  console.log(util.inspect(results, {depth: null}));
});
 
process.stdin.pipe(p);
