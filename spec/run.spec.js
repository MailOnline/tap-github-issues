'use strict';

const run = require('../lib/run');
const assert = require('assert');
const nock = require('nock');
const fs = require('fs');
const path = require('path');
const moment = require('moment');


describe('cli', () => {
  let log;
  const cons = {};
  let stream;

  beforeEach(() => {
    replaceConsole();
    process.stdin.setEncoding('utf8');
    log = '';
    stream = fs.createReadStream(path.join(__dirname, 'fixtures', 'input.tap'));
  });

  afterEach(() => {
    restoreConsole();
    nock.cleanAll();
  });

  it('should create issue', () => {
    mockIssues([]);
    mock('post', '/repos/MailOnline/videojs-vast-vpaid/issues', './fixtures/create_issue.json');

    return ok(run(['-l', 'ghlint'], stream, false))
    .then(() => {
      const lines = log.split('\n');
      assert(/^not ok \(creating/.test(lines[0]));
      assert(/^ok \(no issue/.test(lines[1]));
      assert(nock.isDone());
    });
  });

  it('should close issue', () => {
    mockIssues('./fixtures/issues_1.json');
    mock('post', '/repos/MailOnline/videojs-vast-vpaid/issues/2/comments', {}); // add comment
    mock('patch', '/repos/MailOnline/videojs-vast-vpaid/issues/2', {}); // close issue

    return ok(run(['-l', 'ghlint'], stream, false))
    .then(() => {
      const lines = log.split('\n');
      assert(/^not ok \(recent/.test(lines[0]));
      assert(/^ok \(closing/.test(lines[1]));
      assert(nock.isDone());
    });
  });

  it('should re-open issue', () => {
    mockIssues('./fixtures/issues_2.json');
    mock('post', '/repos/MailOnline/videojs-vast-vpaid/issues/1/comments', {}); // add comment
    mock('patch', '/repos/MailOnline/videojs-vast-vpaid/issues/1', {}); // re-open issue

    return ok(run(['-l', 'ghlint'], stream, false))
    .then(() => {
      const lines = log.split('\n');
      assert(/^not ok \(re-opening/.test(lines[0]));
      assert(/^ok \(resolved/.test(lines[1]));
      assert(nock.isDone());
    });
  });

  it('should remind about the issue', () => {
    const issues = require('./fixtures/issues_3.json');
    issues[0].updated_at = moment().subtract(10, 'days').toISOString();
    mockIssues(issues);
    mock('post', '/repos/MailOnline/videojs-vast-vpaid/issues/1/comments', {}); // add comment

    return ok(run(['-l', 'ghlint'], stream, false))
    .then(() => {
      const lines = log.split('\n');
      assert(/^not ok \(reminding/.test(lines[0]));
      assert(/^ok \(no issue/.test(lines[1]));
      assert(nock.isDone());
    });
  });

  it('should throw if label is not passed', () => {
    return fail(run([], stream, false));
  });


  function mock(method, apiPath, data) {
    if (typeof data == 'string') data = require(data);
    nock('https://api.github.com')[method](apiPath).reply(200, data);
  }

  function mockIssues(data) {
    mock('get', '/repos/MailOnline/videojs-vast-vpaid/issues?labels=ghlint&state=all&per_page=30&page=1', data);
  }

  function replaceConsole() {
    eachCons(method => {
      cons[method] = console[method];
      console[method] = saveLog;
    });
  }

  function restoreConsole() {
    eachCons(method => {
      console[method] = cons[method];
    });
  }

  function ok(p) {
    return p.then(restoreConsole, (e) => {
      restoreConsole();
      throw e;
    });
  }

  function fail(p) {
    return ok(p)
    .then(
      () => { throw new Error('should have thrown'); },
      () => {}
    );
  }

  function eachCons(func) {
    ['log', 'warn', 'error'].forEach(func);
  }

  function saveLog() {
    if (log) log += '\n';
    log += Array.prototype.join.call(arguments, ' ');
  }
});
