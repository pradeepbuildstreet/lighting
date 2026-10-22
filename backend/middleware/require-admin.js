"use strict";
const jwt=require('jsonwebtoken');const {query}=require('../db/database');const {loadConfig}=require('../config/runtime');
const COOKIE_NAME='lighting_admin_session';
function checkOrigin(req,res,next){
 if(['GET','HEAD','OPTIONS'].includes(req.method))return next();
 const origin=req.get('origin');const config=loadConfig();
 if(!origin || !config.origins.includes(origin))return res.status(403).json({error:'Allowed Origin header is required for writes.'});
 return next();
}
function sessionCookieOptions(){return {httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',
 ...(process.env.AUTH_COOKIE_DOMAIN?{domain:process.env.AUTH_COOKIE_DOMAIN}:{})};}
async function requireAdmin(req,res,next){
 if(!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length<32)return res.status(503).json({error:'Admin authentication is not configured.'});
 let permitted=false;checkOrigin(req,res,()=>{permitted=true;});if(!permitted)return;
 const token=req.cookies?.[COOKIE_NAME];if(!token)return res.status(401).json({error:'Admin sign-in required.'});
 let claims;
 try{claims=jwt.verify(token,process.env.AUTH_SECRET,{algorithms:['HS256']});}
 catch(_){return res.status(401).json({error:'Admin sign-in required.'});}
 if(typeof claims==='string'||typeof claims.sub!=='string'||!/^[0-9a-f-]{36}$/i.test(claims.sub))return res.status(401).json({error:'Admin sign-in required.'});
 try{
  const result=await query("SELECT id,email FROM app_users WHERE id=$1 AND role='admin' AND is_active=TRUE",[claims.sub]);
  if(!result.rows.length)return res.status(403).json({error:'Admin access required.'});
  req.admin=result.rows[0];res.set('Cache-Control','no-store');return next();
 }catch(error){return next(error);}
}
module.exports={COOKIE_NAME,checkOrigin,requireAdmin,sessionCookieOptions};
