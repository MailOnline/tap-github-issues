# tap-github-issues
Test reporter that converts TAP output into github issues in multiple orgs/repos

[![npm version](https://badge.fury.io/js/tap-github-issues.svg)](https://www.npmjs.com/package/tap-github-issues)


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


## License

[MIT](https://github.com/MailOnline/tap-github-issues/blob/master/LICENSE)
