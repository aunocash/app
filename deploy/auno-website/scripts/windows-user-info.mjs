// Windows sandbox can deny os.userInfo; use the existing username only for tsx's temp-folder suffix.
import os from 'node:os';
const original=os.userInfo;
os.userInfo=(...args)=>{try{return original(...args)}catch(e){if(e.code!=='ERR_SYSTEM_ERROR')throw e;return {username:process.env.USERNAME||'auno',uid:-1,gid:-1,shell:null,homedir:os.homedir()}}};
