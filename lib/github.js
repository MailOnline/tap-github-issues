'use strict';

const rp = require('request-promise');

const ghApi = 'https://api.github.com';

module.exports = {
  repo: {
    meta(repo, opts) {
      return rp.get(params(`/repos/${repo}`, true, opts));
    }
  },
  issue: {
    enable(repo, opts) {
      return rp.put(params(`/repos/${repo}`, {has_issues: true}, opts));
    },
    list(repo, opts) {
      return allPages(`/repos/${repo}/issues`, opts, {labels: opts.label, state: 'all'});
    },
    create(repo, issue, opts) {
      return rp.post(params(`/repos/${repo}/issues`, issue, opts));
    },
    comment(repo, issue, body, opts) {
      return rp.post(params(`/repos/${repo}/issues/${issue.number}/comments`, {body}, opts));
    },
    comments(repo, issue, opts) {
      return allPages(`/repos/${repo}/issues/${issue.number}/comments`, opts);
    },
    close: changeIssueState('closed'),
    reopen: changeIssueState('open'),
    setLabels(repo, issue, labels, opts) {
      return rp.put(params(`/repos/${repo}/issues/${issue.number}/labels`, labels, opts));
    }
  }
};


function changeIssueState(state) {
  return (repo, issue, opts) => rp.patch(params(`/repos/${repo}/issues/${issue.number}`, {state}, opts));
}


const PAGE_SIZE = 30;
function allPages(ghPath, opts, qs={}) {
  qs.per_page = PAGE_SIZE;
  let result = [];
  let page = 1;
  return getPage();

  function getPage() {
    qs.page = page;
    return rp.get(params(ghPath, true, opts, qs)).then(rows => {
      result.push.apply(result, rows);
      if (rows.length < PAGE_SIZE) return result;
      page++;
      return getPage();
    });
  }
}


function params(ghPath, json, opts, qs) {
  return {
    uri: ghApi + ghPath,
    json,
    auth: opts.auth,
    headers: { 'User-Agent': 'gh-lint' },
    qs
  };
}
