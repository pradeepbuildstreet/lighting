"use strict";
// Compatibility exports; application and catalogue share one configured connection.
const {pool,query,transaction:withTransaction}=require('./connection');
module.exports={pool,query,withTransaction};
