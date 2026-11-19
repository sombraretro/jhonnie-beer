'use strict';
const el=id=>document.getElementById(id);
function notice(text,error=false){el('status').textContent=text;el('status').className=error?'error':'good'}
async function initialize(){try{const state=await window.offlineActivation.status();notice(state.reason||'Digite a chave fornecida pelo responsável pela instalação.',false)}catch(e){notice(e.message||String(e),true)}}
el('activate').addEventListener('click',async()=>{const button=el('activate');button.disabled=true;try{const result=await window.offlineActivation.activate(el('serial').value);if(!result.valid){notice(result.reason||'Chave não reconhecida.',true)}else{el('serial').value='';notice('Ativação registrada. Abrindo o Uni-PDV…')}}catch(e){notice(e.message||String(e),true)}finally{button.disabled=false}});
initialize();
