// Uses the same authenticated, allow-listed AI Gateway boundary as review drafts.
module.exports = require('./review-reply.js').createHandler({ task: 'workshop' });
