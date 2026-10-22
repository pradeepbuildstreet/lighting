"use strict";
const path=require('node:path');
require('dotenv').config({path:path.resolve(__dirname,'../.env')});
const {Pool}=require('pg'),{loadConfig}=require('../config/runtime'),{createConnection}=require('./connection-core');
module.exports=createConnection({Pool,readConfig:()=>loadConfig(),logError:event=>console.error(JSON.stringify(event))});
