'use strict';
// Explicitly invoked by the server integration in the subsequent activation commit.
// Keeps customer module preparation separate from production route activation.
module.exports = require('./interior-public');
