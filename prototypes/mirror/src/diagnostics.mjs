const tokenStates=['not_requested','requesting','issued','failed'];
const codes=['','CONFIG_FAILED','TOKEN_FAILED','CONNECT_FAILED','SET_FAILED','PLAYBACK_FAILED','REMOTE_ERROR','START_TIMEOUT','TRIAL_TIMEOUT','CONNECTION_ENDED','SESSION_ENDED','INVALID_API_KEY','TOKEN_EXPIRED','WEB_RTC_ERROR','MODEL_NOT_FOUND','INVALID_INPUT','TOKEN_CREATE_ERROR','SERVER_ERROR','CAPACITY_EXCEEDED','QUOTA_EXCEEDED','INSUFFICIENT_CREDITS'];
export const emptyDiagnosis=()=>({token:'not_requested',connected:false,frames:0,references:0,error:''});
export function safeCode(error,fallback='CONNECT_FAILED'){
  if(codes.includes(error?.code)&&error.code)return error.code;
  if(Number.isInteger(error?.status)&&error.status>=400&&error.status<=599)return 'HTTP_'+error.status;
  return codes.includes(fallback)?fallback:'CONNECT_FAILED';
}
export function cleanDiagnosis(value){
  const result=emptyDiagnosis();
  if(!value||typeof value!=='object')return result;
  if(tokenStates.includes(value.token))result.token=value.token;
  result.connected=value.connected===true;
  for(const key of ['frames','references'])if(Number.isSafeInteger(value[key])&&value[key]>=0&&value[key]<=1000000)result[key]=value[key];
  if(typeof value.error==='string'&&(codes.includes(value.error)||/^HTTP_[45][0-9]{2}$/.test(value.error)))result.error=value.error;
  return result;
}
