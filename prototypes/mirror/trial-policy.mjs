import {randomBytes,timingSafeEqual} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
export const MODEL='lucy-2.6',CLIENT_SECONDS=25,SERVER_SECONDS=30;
export const tokenOptions=origin=>({expiresIn:45,allowedModels:[MODEL],allowedOrigins:[origin],constraints:{realtime:{maxSessionDuration:SERVER_SECONDS}}});
export function createTokenGate({reservationPath,configured,mint}){
  const csrf=randomBytes(32).toString('hex');let reserved=existsSync(reservationPath);
  return {
    config:()=>({csrf,configured,reserved,model:MODEL,clientSeconds:CLIENT_SECONDS,serverSeconds:SERVER_SECONDS}),
    async issue({origin,expectedOrigin,secret,body}){
      if(origin!==expectedOrigin||typeof secret!=='string'||!/^[a-f0-9]{64}$/.test(secret)||!timingSafeEqual(Buffer.from(secret),Buffer.from(csrf)))return {code:403,error:'Origin/token rejected'};
      if(body?.start!==true)return {code:400,error:'Explicit start required'};
      if(!configured)return {code:503,error:'Decart is not configured'};
      if(reserved)return {code:409,error:'This trial has already been reserved'};
      reserved=true;
      try{
        await writeFile(reservationPath,JSON.stringify({reservedAt:new Date().toISOString(),model:MODEL,seconds:SERVER_SECONDS}),{flag:'wx',mode:0o600});
        const token=await mint(tokenOptions(expectedOrigin));
        if(typeof token.apiKey!=='string'||token.apiKey.startsWith('dct_')||token.constraints?.realtime?.maxSessionDuration!==SERVER_SECONDS||JSON.stringify(token.permissions?.models)!==JSON.stringify([MODEL])||JSON.stringify(token.permissions?.origins)!==JSON.stringify([expectedOrigin]))throw Error('Invalid token scope');
        return {code:200,apiKey:token.apiKey,expiresAt:token.expiresAt};
      }catch{return {code:502,error:'Token creation failed; this reservation is not retried'};}
    }
  };
}
