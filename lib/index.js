'use strict';

const moment = require('moment');
const Ajv = require('ajv');
const github = require('./github');
const comment = require('./comment');

const SEVERITY_LEVELS = ['warning', 'error'];


module.exports = async function processTests(testCases, opts) {
  const tests = prepareTests(testCases);
  let passes = 0, newIssues = 0, closedIsues = 0, reopenedIssues = 0, remindedIssues = 0;
  for (const repo in tests)
    await processRepo(repo, tests[repo]);

  console.log(`passed ${passes} out of ${testCases.length}`);
  console.log(`issues: ${newIssues} new, ${closedIsues} closed, ${reopenedIssues} re-opened, ${remindedIssues} reminded`);


  async function processRepo(repo, repoTests) {
    if (opts.enable) await checkEnableIssues();
    const existingIssues = await github.issue.list(repo, opts);
    for (const test of repoTests) {
      const ok = test.ok;
      let {rule, issue, messages, severity} = test.diag;
      issue = issue || {title: `Fix rule ${rule}`};

      let ghIssue;
      const ghIssues = existingIssues.filter(matchIssue(rule))
                                     .sort(compareIssueDate);
      if (ghIssues.length > 0) {
        ghIssue = ghIssues.filter(({state}) => state == 'open').pop();
        if (!ghIssue && issue.reopen !== false)
          ghIssue = ghIssues.pop();
      }

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
          if (issue.remind === false)
            return console.log('not ok (reminders disabled):', rule, ghIssue.html_url);
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
    }

    async function checkEnableIssues() {
      const meta = await github.repo.meta(repo, opts);
      if (!meta.has_issues) {
        console.log('issues disabled (enabling...):', repo);
        if (opts.dry) return;
        await github.issue.enable(repo, opts);
      }
    }
  }
};


let ajv, validate;
const ERROR_OPTS = {dataVar: 'test', separator: '\n'};
function prepareTests(testCases) {
  if (!ajv) {
    ajv = new Ajv({allErrors: true});
    validate = ajv.compile(require('../schema/test.json'));
  }

  const tests = {};
  for (let i=0; i<testCases.length; i++) {
    const test = testCases[i];
    if (!validate(test)) {
      const msg = ajv.errorsText(validate.errors, ERROR_OPTS);
      console.warn(`skipping invalid test #${i} (${test.name}):\n${msg}`);
      continue;
    }
    const repo = test.diag.repo;
    const repoTests = tests[repo] = tests[repo] || [];
    repoTests.push(test);
  }
  return tests;
}


function matchIssue(rule) {
  const ruleStr = `[${rule}]`;
  return ({title}) => title.indexOf(ruleStr) >= 0;
}

function compareIssueDate(issue1, issue2) {
  const d1 = new Date(issue1.updated_at);
  const d2 = new Date(issue2.updated_at);
  if (d1 < d2) return -1;
  if (d1 > d2) return 1;
  return 0;
}

function plural(arr) {
  return arr.length > 1 ? 's' : '';
}
