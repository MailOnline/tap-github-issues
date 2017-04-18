'use strict'

const minimist = require('minimist');
const Parser = require('tap-parser');
const moment = require('moment');
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
    const existingIssues = yield github.issue.list(repo, opts);
    for (const test of repoTests) {
      const ok = test.ok;
      const {rule, issue, message, severity} = test.diag;
      const existing = existingIssues.find(({title}) =>
        title.indexOf(issue.title) >= 0 && title.indexOf(rule) >= 0);

      if (existing) {
        if (existing.state == 'open') {
          if (ok) {
            console.log('ok (closing...):', rule, repo);
            yield github.issue.comment(repo, existing, issue.comments.close, opts);
            yield github.issue.close(repo, existing, opts);
          } else {
            const passedDays = moment().diff(existing.updated_at, 'days', true);
            if (passedDays >= opts.remind) {
              console.log('not ok (reminding...):', rule, repo);
              yield github.issue.comment(repo, existing, issue.comments.update, opts);
            } else {
              console.log('not ok (recent):', rule, repo);
            }
          }
        } else { // issue state == 'closed'
          if (ok) {
            console.log('ok (resolved):', rule, repo);
          } else {
            console.log('not ok (re-opening...):', rule, repo);
            yield github.issue.comment(repo, existing, issue.comments.reopen, opts);
            yield github.issue.reopen(repo, existing, opts);
          }
        }
      } else {
        if (ok) {
          console.log('ok (no issue):', rule, repo);
        } else {
          yield github.issue.create(repo, {
            title: `[${rule}] ${issue.title}`,
            body: `${issue.comments.create}`,
            labels: [opts.label]
          }, opts)
          console.log('not ok (creating...):', rule, repo);
        }
      }
    }
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
 
  opts.remind = argv.r || argv.remind || 7;

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
