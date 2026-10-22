# Historical tool: create-admin-fresh.js

Archived from `backend/scripts/create-admin-fresh.js`. Reference only; not supported setup or an executable upgrade step. Do not copy/run without a separate data-operation review. Original source follows.

```javascript
"use strict";
require('dotenv').config({path:require('node:path').resolve(__dirname,'../.env')});
const {Pool}=require('pg');const bcrypt=require('bcryptjs');
async function main(){
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL required');
 const email=(process.env.ADMIN_EMAIL||'').trim().toLowerCase();const password=process.env.ADMIN_PASSWORD||'';
 if(!/^\S+@\S+\.\S+$/.test(email))throw new Error('Valid ADMIN_EMAIL required');
 if(password.length<14)throw new Error('Use ADMIN_PASSWORD of at least 14 characters');
 const pool=new Pool({connectionString:process.env.DATABASE_URL});
 try{await pool.query('INSERT INTO app_users(email,password_hash,role) VALUES($1,$2,$3)',[email,await bcrypt.hash(password,12),'admin']);console.log('Admin created');}
 finally{await pool.end();}
}
main().catch(e=>{console.error(e.code==='23505'?'Admin already exists':e.message);process.exitCode=1;});

```
