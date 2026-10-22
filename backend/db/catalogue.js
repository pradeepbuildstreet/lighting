"use strict";
// Compatibility exports; no separate catalogue pool or identity synchronization.
const {query,transaction,close}=require('./connection');
const {validateAdminActor:actor}=require('../services/admin-actor');
module.exports={query,transaction,actor,close};
