import {createDecartClient,models,noopLogger} from '@decartai/sdk';
export const model=models.realtime('lucy-2.6');
export async function connectLucy(stream:MediaStream,options:{token:()=>Promise<string>;image:File;prompt:string;onStream:(stream:MediaStream)=>void;onConnection:(state:string)=>void}){
  const client=createDecartClient({apiKeyProvider:options.token,telemetry:false,logger:noopLogger});
  return client.realtime.connect(stream,{
    model,mirror:false,retries:0,capacityRetryBudgetMs:0,resolution:'720p',preferredVideoCodec:'vp8',
    onRemoteStream:options.onStream,onConnectionChange:options.onConnection,
    initialState:{image:options.image,prompt:{text:options.prompt,enhance:false}}
  });
}
