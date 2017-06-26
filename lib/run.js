'use strict';

const minimist = require('minimist');
const Parser = require('tap-parser');
const processTests = require('./index');


module.exports = (_argv, stream=process.stdin, doExit) => {
  return new Promise((resolve, reject) => {
    let opts = getOptions(_argv, doExit);
    if (opts.dry) console.log('"dry" mode: no changes to GitHub issues are made');
    else console.log('updating GitHub issues');
    const p = new Parser({passes: true}, function (results) {
      const testCases = results.failures.concat(results.passes);
      processTests(testCases, opts).then(resolve, reject);
    });

    stream.pipe(p);
  });
};


function getOptions(__argv, doExit) {
  const argv = minimist(__argv);
  const options = {
    label: argv.l || argv.label
  };
  if (!options.label) {
    console.error('issue label is required');
    if (doExit) process.exit(2);
    throw new Error('issue label is required');
  }

  const user = argv.u || argv.user;
  const pass = argv.p || argv.pass;
  if (user || pass) options.auth = {user, pass};

  options.remind = argv.r || argv.remind || 7;
  options.dry = argv.dry;
  options.severity = argv.severity;

  return options;
}
