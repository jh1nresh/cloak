import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanDiagnosis,emptyDiagnosis,safeCode} from '../src/diagnostics.mjs';
test('diagnosis keeps only bounded technical evidence',()=>{
  const clean=cleanDiagnosis({token:'issued',connected:true,frames:42,references:2,error:'HTTP_401',apiKey:'secret',image:'private',url:'private'});
  assert.deepEqual(clean,{token:'issued',connected:true,frames:42,references:2,error:'HTTP_401'});
});
test('malformed or secret-like fields never survive restored diagnosis',()=>{
  for(const value of [null,[],{token:'secret',connected:'true',frames:Infinity,references:-1,error:['HTTP_401']},{error:'dct_private_token',frames:'10'}])assert.deepEqual(cleanDiagnosis(value),emptyDiagnosis());
});
test('raw exception messages and unrecognized codes are never persisted',()=>{
  assert.equal(safeCode({message:'dct_secret',code:'dct_secret'}),'CONNECT_FAILED');
  assert.equal(safeCode({status:403,message:'secret'}),'HTTP_403');assert.equal(safeCode({code:'TOKEN_EXPIRED'}),'TOKEN_EXPIRED');
});
