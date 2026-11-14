import {FilesetResolver,HandLandmarker} from '@mediapipe/tasks-vision';
let detector:HandLandmarker|null=null;
const pixels=new OffscreenCanvas(384,216);
const context=pixels.getContext('2d',{willReadFrequently:true})!;
self.onmessage=async(event:MessageEvent)=>{
  const data=event.data;
  if(data.type==='init') {
    try {
      const vision=await FilesetResolver.forVisionTasks(data.base+'wasm');
      detector=await HandLandmarker.createFromOptions(vision,{canvas:new OffscreenCanvas(384,216),baseOptions:{modelAssetPath:data.base+'models/hand_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.65,minHandPresenceConfidence:.65,minTrackingConfidence:.65});
      self.postMessage({type:'ready'});
    } catch(error) { self.postMessage({type:'error',stage:'init',message:String(error).slice(0,300)}); }
    return;
  }
  if(data.type==='frame') {
    const frame=data.frame as ImageBitmap;
    try {
      if(pixels.width!==frame.width||pixels.height!==frame.height){pixels.width=frame.width;pixels.height=frame.height;}
      context.drawImage(frame,0,0);
      const result=detector?.detectForVideo(context.getImageData(0,0,frame.width,frame.height),data.at);
      self.postMessage({type:'result',points:result?.landmarks[0]??null,worldPoints:result?.worldLandmarks[0]??null});
    } catch(error) { self.postMessage({type:'error',stage:'frame',message:error instanceof Error?error.stack?.slice(0,1400):String(error)}); }
    finally { frame.close(); }
  }
};
