"use strict";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function denied(){const e=new Error('Active administrator account required.');e.status=403;e.code='ADMIN_IDENTITY_REQUIRED';return e;}
async function validateAdminActor(client,user){
 if(!user||typeof user.id!=='string'||!UUID.test(user.id))throw denied();
 // Call with the protected write transaction client; never synchronize account fields.
 const result=await client.query('SELECT id,email,role,is_active FROM public.app_users WHERE id=$1 FOR SHARE',[user.id]);
 const row=result.rows[0];
 if(!row||row.role!=='admin'||row.is_active!==true)throw denied();
 return {id:row.id,email:row.email,role:row.role,is_active:row.is_active};
}
module.exports={validateAdminActor};
