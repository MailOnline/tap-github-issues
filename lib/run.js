'use strict';

const minimist = require('minimist');
const Parser = require('tap-parser');
const moment = require('moment');
const co = require('co');
const github = require('./github');
const comment = require('./comment');


module.exports = (_argv, stream=process.stdin, doExit) => {
  let opts;

  return new Promise((resolve, reject) => {
    opts = getOptions(_argv);
    if (opts.dry) console.log('"dry" mode: no changes to GitHub issues are made');
    else console.log('updating GitHub issues');
    const p = new Parser({passes: true}, function (results) {
      const tests = prepareTests(results);
      co(function *() {
        for (const repo in tests) yield processRepo(repo, tests[repo]);
      }).then(resolve, reject);
    });

    stream.pipe(p);
  });

  function *processRepo(repo, repoTests) {
    const existingIssues = yield github.issue.list(repo, opts);
    for (const test of repoTests) {
      const ok = test.ok;
      let {rule, issue, messages/*, message, severity*/} = test.diag;
      issue = issue || {title: `Fix rule ${rule}`};
      let ghIssue = existingIssues.find(({title}) =>
        title.indexOf(issue.title) >= 0 && title.indexOf(rule) >= 0);

      if (ok) {
        if (ghIssue && ghIssue.state == 'open')
          yield closeIssue();
        else if (ghIssue)
          console.log('ok (resolved):', rule, ghIssue.html_url);
        else
          console.log('ok (no issue):', rule, repo);
      } else {
        if (ghIssue && ghIssue.state == 'open')
          yield remindAboutIssue();
        else if (ghIssue)
          yield reopenIssue();
        else
          ghIssue = yield createIssue();

        if (messages && messages.length)
          yield updateIssueComments();
      }


      function *createIssue() {
        if (opts.dry) return console.log('not ok (creating...):', rule, repo);

        const newIssue = yield github.issue.create(repo, {
          title: `[${rule}] ${issue.title}`,
          body: `${comment.create(issue, rule)}`,
          labels: [opts.label]
        }, opts);
        console.log('not ok (creating...):', rule, newIssue.html_url);
        return newIssue;
      }

      function *closeIssue() {
        console.log('ok (closing...):', rule, ghIssue.html_url);
        if (opts.dry) return;
        yield github.issue.comment(repo, ghIssue, comment.close(issue, rule), opts);
        yield github.issue.close(repo, ghIssue, opts);
      }

      function *remindAboutIssue() {
        const passedDays = moment().diff(ghIssue.updated_at, 'days', true);
        if (passedDays >= opts.remind) {
          console.log('not ok (reminding...):', rule, ghIssue.html_url);
          if (opts.dry) return;
          yield github.issue.comment(repo, ghIssue, comment.update(issue, rule), opts);
        } else {
          console.log('not ok (recent):', rule, ghIssue.html_url);
        }
      }

      function *reopenIssue() {
        console.log('not ok (re-opening...):', rule, ghIssue.html_url);
        if (opts.dry) return;
        yield github.issue.comment(repo, ghIssue, comment.reopen(issue, rule), opts);
        yield github.issue.reopen(repo, ghIssue, opts);
      }

      function *updateIssueComments() {
        if (opts.dry && !ghIssue) return console.log(`adding ${messages.length} comment(s) to issue`);
        const existingComments = yield github.issue.comments(repo, ghIssue, opts);
        for (const msg of messages) {
          const ghComment = existingComments.find(({body}) => body == msg);
          if (ghComment) {
            console.log('comment (exists):', rule, ghComment.html_url);
          } else {
            let newComment;
            if (!opts.dry) newComment = yield github.issue.comment(repo, ghIssue, msg, opts);
            console.log('comment (adding...):', rule, (newComment || ghIssue).html_url);
          }
        }
      }
    }
  }


  function getOptions(__argv) {
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

    return options;
  }
};


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
