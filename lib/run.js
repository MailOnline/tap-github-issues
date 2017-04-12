'use strict'

const minimist = require('minimist');
const Parser = require('tap-parser');
const co = require('co');
const github = require('./github');

module.exports = (_argv, doExit) => {
  const opts = getOptions(_argv);

  return new Promise((resolve, reject) => {
    var p = new Parser({passes: true}, function (results) {
      const tests = prepareTests(results);
      co(function *() {
        for (const repo in tests) yield processRepo(repo, tests[repo]);
      }).then(resolve, reject);
    });
     
    process.stdin.pipe(p);
  });

  function *processRepo(repo, repoTests) {
    console.log('repo', repo);
    const existingIssues = yield github.issue.list(repo, opts);
    return Promise.all(repoTests.map(function (test) {
      const ok = test.ok;
      const {rule, issue, message, severity} = test.diag;
      const existing = existingIssues.find(({title}) =>
        title.indexOf(issue.title) >= 0 && title.indexOf(rule) >= 0);

      let p;
      if (existing) {
        if (existing.state == 'open') {
          if (ok) {
            console.log('closed issue:', repo, rule);
            p = github.issue.comment(repo, existing, issue.comments.close, opts)
            .then(() => github.issue.close(repo, existing, opts));
          } else {
            console.log('TODO maybe comment and remind', existing.url);
            // p = check date, maybe comment if older than reminder threshold
          }
        } else if (!ok) { // issue state == 'closed'
          console.log('re-opened issue:', repo, rule);
          p = github.issue.comment(repo, existing, issue.comments.reopen, opts)
          .then(() => github.issue.reopen(repo, existing, opts));
        }
      } else if (!ok) {
        console.log('created issue:', repo, rule);
        p = github.issue.create(repo, {
          title: `[${rule}] ${issue.title}`,
          body: `${issue.comments.create}`,
          labels: [opts.label]
        }, opts);
      }

      return p;
    }));
  }
};


function getOptions(_argv) {
  const argv = minimist(_argv);
  const opts = {
    label: argv.l || argv.label
  };
  if (!opts.label) {
    console.error('issue label is required');
    process.exit(2);
  }

  const user = argv.u || argv.user;
  const pass = argv.p || argv.pass;
  if (user || pass) opts.auth = {user, pass};
 
  return opts;
}


function prepareTests(results) {
  const testCases = results.failures.concat(results.passes);
  // console.log(testCases);
  const tests = {};
  for (const test of testCases) {
    const repo = test.diag.repo;
    const repoTests = tests[repo] = tests[repo] || [];
    repoTests.push(test);
  }
  return tests;
}
