'use strict';


const comment = module.exports = {
  create({comments}={}, rule) {
    return comments && comments.create || `Please fix rule **${rule}**`;
  },
  update({comments}={}, rule) {
    return comments && comments.update || `Reminder: ${_create(comments, rule)}`;
  },
  close({comments}={}, rule) {
    return comments && comments.close || `Rule **${rule}** fixed`;
  },
  reopen({comments}={}, rule) {
    return comments && comments.reopen || `Re-opened: ${_create(comments, rule)}`;
  }
};


function _create(comments, rule) {
  const str = comment.create({comments}, rule);
  return str[0].toLowerCase() + str.slice(1);
}
