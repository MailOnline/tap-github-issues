'use strict';

const minimist = require('minimist');
const Parser = require('tap-parser');
const moment = require('moment');
const github = require('./github');
const comment = require('./comment');

const SEVERITY_LEVELS = ['warning', 'error'];

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


async function processTests(testCases, opts) {
  const tests = prepareTests(testCases);
  let passes = 0, newIssues = 0, closedIsues = 0, reopenedIssues = 0, remindedIssues = 0;
  for (const repo in tests)
    await processRepo(repo, tests[repo]);

  console.log(`passed ${passes} out of ${testCases.length}`);
  console.log(`issues: ${newIssues} new, ${closedIsues} closed, ${reopenedIssues} re-opened, ${remindedIssues} reminded`);


  async function processRepo(repo, repoTests) {
    const existingIssues = await github.issue.list(repo, opts);
    for (const test of repoTests) {
      const ok = test.ok;
      let {rule, issue, messages, severity} = test.diag;
      issue = issue || {title: `Fix rule ${rule}`};
      let ghIssue = existingIssues.find(({title}) =>
        title.indexOf(issue.title) >= 0 && title.indexOf(rule) >= 0);

      if (ok) {
        passes++;
        if (ghIssue && ghIssue.state == 'open')
          await closeIssue();
        else if (ghIssue)
          console.log('ok (resolved):', rule, ghIssue.html_url);
        else
          console.log('ok (no issue):', rule, repo);
      } else {
        if (ghIssue && ghIssue.state == 'open')
          await remindAboutIssue();
        else if (ghIssue)
          await reopenIssue();
        else
          ghIssue = await createIssue();

        if (Array.isArray(messages) && messages.length)
          await updateIssueComments();

        if (ghIssue && opts.severity)
          await updateIssueLabels();
      }


      async function createIssue() {
        newIssues++;
        if (opts.dry) return console.log('not ok (creating...):', rule, repo);

        const newIssue = await github.issue.create(repo, {
          title: `[${rule}] ${issue.title}`,
          body: `${comment.create(issue, rule)}`,
          labels: [opts.label, severity]
        }, opts);
        console.log('not ok (creating...):', rule, newIssue.html_url);
        return newIssue;
      }

      async function closeIssue() {
        closedIsues++;
        console.log('ok (closing...):', rule, ghIssue.html_url);
        if (opts.dry) return;
        await github.issue.comment(repo, ghIssue, comment.close(issue, rule), opts);
        await github.issue.close(repo, ghIssue, opts);
      }

      async function remindAboutIssue() {
        const passedDays = moment().diff(ghIssue.updated_at, 'days', true);
        if (passedDays >= opts.remind) {
          remindedIssues++;
          console.log('not ok (reminding...):', rule, ghIssue.html_url);
          if (opts.dry) return;
          await github.issue.comment(repo, ghIssue, comment.update(issue, rule), opts);
        } else {
          console.log('not ok (recent):', rule, ghIssue.html_url);
        }
      }

      async function reopenIssue() {
        reopenedIssues++;
        console.log('not ok (re-opening...):', rule, ghIssue.html_url);
        if (opts.dry) return;
        await github.issue.comment(repo, ghIssue, comment.reopen(issue, rule), opts);
        await github.issue.reopen(repo, ghIssue, opts);
      }

      async function updateIssueLabels() {
        const ghLabels = ghIssue.labels.map(({name}) => name);
        const newLabels = ghLabels.filter((name) => name == severity || !SEVERITY_LEVELS.includes(name));
        let doUpdate = newLabels.length < ghLabels.length;
        if (!newLabels.includes(severity)) {
          doUpdate = true;
          newLabels.push(severity);
        }
        if (doUpdate) {
          console.log('labels (updating...)');
          if (opts.dry) return;
          await github.issue.setLabels(repo, ghIssue, newLabels, opts);
        }
      }

      async function updateIssueComments() {
        if (opts.dry && !ghIssue) return console.log(`${messages.length} comment${plural(messages)} (adding...)`);
        const existingComments = await github.issue.comments(repo, ghIssue, opts);
        for (const msg of messages) {
          const ghComment = existingComments.find(({body}) => body == msg);
          if (ghComment) {
            console.log('comment (exists):', rule, ghComment.html_url);
          } else {
            let newComment;
            if (!opts.dry) newComment = await github.issue.comment(repo, ghIssue, msg, opts);
            console.log('comment (adding...):', rule, (newComment || ghIssue).html_url);
          }
        }
      }

      function plural(arr) {
        return arr.length > 1 ? 's' : '';
      }
    }
  }
}


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


function prepareTests(testCases) {
  const tests = {};
  for (const test of testCases) {
    const repo = test.diag.repo;
    const repoTests = tests[repo] = tests[repo] || [];
    repoTests.push(test);
  }
  return tests;
}
