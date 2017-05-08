# tap-github-issues
Test reporter that converts TAP output into github issues in multiple orgs/repos

[![Build Status](https://travis-ci.org/MailOnline/tap-github-issues.svg?branch=master)](https://travis-ci.org/MailOnline/tap-github-issues)
[![npm version](https://badge.fury.io/js/tap-github-issues.svg)](https://www.npmjs.com/package/tap-github-issues)
[![Coverage Status](https://coveralls.io/repos/MailOnline/tap-github-issues/badge.svg?branch=master&service=github)](https://coveralls.io/github/MailOnline/tap-github-issues?branch=master)


## Install

```bash
npm install -g tap-github-issues
```


## Usage

```bash
tap-github-issues -l ghlint -u $GITHUB_USERNAME -p $GITHUB_TOKEN
```

where -l option defines the issue label that should be used to identify issues.

The utility consumes TAP output from ghlint.


## Options

- `-l` (or `--label`) - label to identify issues
- `-u` (or `--user`) - GitHub username.
- `-p` (or `--pass`) - GitHub password.
- `-r` (or `--remind`) - the number of days after which the reminder should be added to the issue (the default is 7 days).
- `--dry` - generate report and list of changes to issues without making changes in GitHub


## License

[MIT](https://github.com/MailOnline/tap-github-issues/blob/master/LICENSE)
