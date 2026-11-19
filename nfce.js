const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const forge = require('node-forge');
const { SignedXml } = require('xml-crypto');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const QRCode = require('qrcode');

const NS_NFE='http://www.portalfiscal.inf.br/nfe';
const NS_DS='http://www.w3.org/2000/09/xmldsig#';
const UF_SP='35';
const COD_MUN_ARACATUBA='3502804';
const SERVICE={
  homologacao:{authorize:'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',event:'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeRecepcaoEvento4.asmx',status:'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx',epec:'https://homologacao.nfce.epec.fazenda.sp.gov.br/EPECws/RecepcaoEPEC.asm',qrcode:'https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode'},
  producao:{authorize:'https://nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',event:'https://nfce.fazenda.sp.gov.br/ws/NFeRecepcaoEvento4.asmx',status:'https://nfce.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx',epec:'https://nfce.epec.fazenda.sp.gov.br/EPECws/RecepcaoEPEC.asm',qrcode:'https://www.nfce.fazenda.sp.gov.br/qrcode'}
};
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const tag=(name,value,attrs='')=>value===undefined||value===null||value===''?`<${name}${attrs}/>`:`<${name}${attrs}>${esc(value)}</${name}>`;
const num=v=>Number(v||0).toFixed(2);
const pad=(v,n)=>String(v).padStart(n,'0');
const digits=v=>String(v??'').replace(/\D/g,'');
const sha1hex=s=>crypto.createHash('sha1').update(s,'utf8').digest('hex');
const sha1b64=s=>crypto.createHash('sha1').update(s,'utf8').digest('base64');
function accessKey({cnpj,number,series,date,tpEmis=1,cNF}){
 const base=UF_SP+date.toISOString().slice(0,7).replace('-','')+digits(cnpj).padStart(14,'0')+'65'+pad(series,3)+pad(number,9)+String(tpEmis)+pad(cNF,8);
 let sum=0,weight=2;for(let i=base.length-1;i>=0;i--){sum+=Number(base[i])*weight;weight=weight===9?2:weight+1}const dv=(11-(sum%11))%10;return base+dv;
}
function localIso(){const d=new Date();const off=-d.getTimezoneOffset();const sign=off>=0?'+':'-';const hh=pad(Math.floor(Math.abs(off)/60),2),mm=pad(Math.abs(off)%60,2);return d.toISOString().replace('Z',`${sign}${hh}:${mm}`)}
function cleanAddress(s){const parts=String(s||'').split(',').map(x=>x.trim());return {xLgr:parts[0]||'',nro:parts[1]||'SN',xBairro:parts[2]||'',xMun:parts[3]||'Araçatuba',UF:parts[4]||'SP',CEP:digits(parts[5]||'')};}
function loadPfx(certPath,password){
 const der=fs.readFileSync(certPath);const p12Asn1=forge.asn1.fromDer(der.toString('binary'));const p12=forge.pkcs12.pkcs12FromAsn1(p12Asn1,false,password);let keyBag=null,certBag=null;
 for(const safe of p12.safeContents){for(const bag of safe.safeBags){if(bag.type===forge.pki.oids.pkcs8ShroudedKeyBag||bag.type===forge.pki.oids.keyBag)keyBag=bag; if(bag.type===forge.pki.oids.certBag)certBag=bag;}}
 if(!keyBag||!certBag)throw new Error('Não foi possível ler o certificado A1 (PFX/P12). Verifique o arquivo e a senha.');
 const privateKey=forge.pki.privateKeyToPem(keyBag.key);const cert=forge.pki.certificateToPem(certBag.cert);const certDer=forge.asn1.toDer(forge.pki.certificateToAsn1(certBag.cert)).getBytes();
 return {privateKey,certificate:cert,certificateBase64:forge.util.encode64(certDer),subject:certBag.cert.subject.attributes.map(a=>`${a.shortName||a.name}=${a.value}`).join(', '),serial:certBag.cert.serialNumber,validFrom:certBag.cert.validity.notBefore,validTo:certBag.cert.validity.notAfter};
}
function signXml(xml,refId,cert,locationXPath="//*[local-name(.)='infNFe']"){ 
 const sig=new SignedXml({privateKey:cert.privateKey,publicCert:cert.certificate});
 sig.signatureAlgorithm='http://www.w3.org/2000/09/xmldsig#rsa-sha1';
 sig.canonicalizationAlgorithm='http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
 sig.addReference({xpath:`//*[@Id='${refId}']`,transforms:['http://www.w3.org/2000/09/xmldsig#enveloped-signature','http://www.w3.org/TR/2001/REC-xml-c14n-20010315'],digestAlgorithm:'http://www.w3.org/2000/09/xmldsig#sha1'});

 sig.computeSignature(xml,{location:{reference:locationXPath,action:'append'}});
 return sig.getSignedXml();
}
function findTag(xml,name){const m=xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));return m?m[1].replace(/<[^>]+>/g,'').trim():'';}
function stripCdata(v){return String(v||'').replace(/^<!\[CDATA\[/,'').replace(/\]\]>$/,'')}
function parseResponse(xml){const clean=stripCdata(xml);return {cStat:findTag(clean,'cStat'),xMotivo:findTag(clean,'xMotivo'),chNFe:findTag(clean,'chNFe'),nProt:findTag(clean,'nProt'),dhRecbto:findTag(clean,'dhRecbto'),digVal:findTag(clean,'digVal'),cMsg:findTag(clean,'cMsg'),xMsg:findTag(clean,'xMsg'),nRec:findTag(clean,'nRec'),raw:xml};}
function soapEnvelope(serviceName,bodyXml,ns='http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4',versaoDados='4.00'){
 return `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Header><nfeCabecMsg xmlns="${ns}"><cUF>35</cUF><versaoDados>${versaoDados}</versaoDados></nfeCabecMsg></soap12:Header><soap12:Body><nfeDadosMsg xmlns="${ns}">${bodyXml}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;
}
function requestXml(url,soapAction,xml,pfxPath,password){return new Promise((resolve,reject)=>{const u=new URL(url);const req=https.request({hostname:u.hostname,port:443,path:u.pathname+u.search,method:'POST',pfx:fs.readFileSync(pfxPath),passphrase:password,rejectUnauthorized:true,headers:{'Content-Type':`application/soap+xml; charset=utf-8; action="${soapAction}"`,'Content-Length':Buffer.byteLength(xml)}} ,res=>{let data='';res.setEncoding('utf8');res.on('data',d=>data+=d);res.on('end',()=>resolve({statusCode:res.statusCode,body:data}));});req.on('error',reject);req.write(xml);req.end();});}
function paymentCode(method){return {'Dinheiro':'01','Cheque':'02','Cartão de crédito':'03','Cartão de débito':'04','PIX':'17','Venda a prazo':'05'}[method]||'99'}
function buildTax(item,crt){const origin=String(item.origin||'0');const code=String(item.cst_csosn||'102');if(String(crt)==='1'){const cs=code||'102';if(cs==='500')return `<ICMSSN500>${tag('orig',origin)}${tag('CSOSN','500')}</ICMSSN500>`;if(cs==='900')return `<ICMSSN900>${tag('orig',origin)}${tag('CSOSN','900')}${tag('vBC',num(item.base_cents/100))}${tag('pCredSN',num(0))}${tag('vCredICMSSN',num(0))}</ICMSSN900>`;return `<ICMSSN102>${tag('orig',origin)}${tag('CSOSN',cs)}</ICMSSN102>`;}const cst=code||'00';if(cst==='40'||cst==='41')return `<ICMS40>${tag('orig',origin)}${tag('CST',cst)}</ICMS40>`;if(cst==='60')return `<ICMS60>${tag('orig',origin)}${tag('CST','60')}</ICMS60>`;return `<ICMS00>${tag('orig',origin)}${tag('CST',cst)}${tag('modBC','3')}${tag('vBC',num(item.base_cents/100))}${tag('pICMS',num(0))}${tag('vICMS',num(0))}</ICMS00>`;}
function buildNfce({settings,sale,items,number,series,tpEmis=1,cNF,environment,contingencyReason=''}){
 const cnpj=digits(settings.company_cnpj);if(cnpj.length!==14)throw new Error('CNPJ do emitente deve ter 14 dígitos.');if(!settings.company_ie)throw new Error('Inscrição estadual do emitente não configurada.');
 const dt=new Date(sale.sold_at||Date.now());const key=accessKey({cnpj,number,series,date:dt,tpEmis,cNF});const address=cleanAddress(settings.company_address);const crt=settings.company_crt||'1';const dhEmi=localIso();
 const xmlItems=items.map((i,idx)=>{const qty=Number(i.quantity||1),unit=Number(i.unit_price_cents||0)/100,total=Number(i.total_cents||0)/100;const p=i.product||{};const ncm=p.ncm||'00000000',cfop=p.cfop||'5102';return `<det nItem="${idx+1}"><prod>${tag('cProd',p.sku||String(i.product_id||i.kit_id||idx+1))}${tag('cEAN','SEM GTIN')}${tag('xProd',i.name)}${tag('NCM',ncm)}${tag('CFOP',cfop)}${tag('uCom',p.unit||'UN')}${tag('qCom',qty.toFixed(4))}${tag('vUnCom',unit.toFixed(10))}${tag('vProd',num(total))}${tag('cEANTrib','SEM GTIN')}${tag('uTrib',p.unit||'UN')}${tag('qTrib',qty.toFixed(4))}${tag('vUnTrib',unit.toFixed(10))}${tag('indTot','1')}</prod><imposto>${buildTax({...p,base_cents:total*100},crt)}<PIS><PISNT><CST>07</CST></PISNT></PIS><COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS></imposto></det>`}).join('');
 const total=Number(sale.total_cents||0)/100;const payments=JSON.parse(sale.payment_json||'[]');const detPag=payments.filter(p=>Number(p.final_cents||p.original_cents||0)>0).map(p=>`<detPag>${tag('indPag',p.method==='Venda a prazo'?'1':'0')}${tag('tPag',paymentCode(p.method))}${tag('vPag',num(Number(p.final_cents||p.original_cents||0)/100))}</detPagPag>`).join('').replace(/<\/detPagPag>/g,'</detPag>');
 const troco=Number(sale.change_cents||0)/100;const supl=[];
 let ide=tag('cUF',UF_SP)+tag('cNF',cNF)+tag('natOp','VENDA AO CONSUMIDOR')+tag('mod','65')+tag('serie',series)+tag('nNF',number)+tag('dhEmi',dhEmi)+tag('tpNF','1')+tag('idDest','1')+tag('cMunFG',settings.company_city_code||COD_MUN_ARACATUBA)+tag('tpImp','4')+tag('tpEmis',tpEmis)+(Number(tpEmis)===9?tag('dhCont',dhEmi)+tag('xJust',contingencyReason||'Indisponibilidade técnica do ambiente autorizador'):'')+tag('cDV',key.slice(-1))+tag('tpAmb',environment==='producao'?'1':'2')+tag('finNFe','1')+tag('indFinal','1')+tag('indPres','1')+tag('procEmi','0')+tag('verProc','Uni-PDV');
 const emit=`<emit>${tag('CNPJ',cnpj)}${tag('xNome',settings.company_legal_name||settings.company_fantasy_name||settings.store_name)}${tag('xFant',settings.company_fantasy_name||settings.store_name)}<enderEmit>${tag('xLgr',address.xLgr)}${tag('nro',address.nro)}${tag('xBairro',address.xBairro)}${tag('cMun',settings.company_city_code||COD_MUN_ARACATUBA)}${tag('xMun',address.xMun)}${tag('UF',address.UF||'SP')}${tag('CEP',address.CEP)}</enderEmit>${tag('IE',digits(settings.company_ie))}${tag('CRT',crt)}</emit>`;
 const dest=sale.customer_document?`<dest>${digits(sale.customer_document).length===14?tag('CNPJ',digits(sale.customer_document)):tag('CPF',digits(sale.customer_document))}${tag('xNome',sale.customer_name||'CONSUMIDOR')}</dest>`:'';
 const icmsTot='<ICMSTot>'+tag('vBC','0.00')+tag('vICMS','0.00')+tag('vICMSDeson','0.00')+tag('vFCP','0.00')+tag('vBCST','0.00')+tag('vST','0.00')+tag('vFCPST','0.00')+tag('vFCPSTRet','0.00')+tag('vProd',num(total))+tag('vFrete','0.00')+tag('vSeg','0.00')+tag('vDesc','0.00')+tag('vII','0.00')+tag('vIPI','0.00')+tag('vIPIDevol','0.00')+tag('vPIS','0.00')+tag('vCOFINS','0.00')+tag('vOutro','0.00')+tag('vNF',num(total))+'</ICMSTot>';
 const pag=`<pag>${detPag||'<detPag><indPag>0</indPag><tPag>99</tPag><vPag>'+num(total)+'</vPag></detPag>'}${troco>0?tag('vTroco',num(troco)):''}</pag>`;
 const root=`<?xml version="1.0" encoding="UTF-8"?><NFe xmlns="${NS_NFE}"><infNFe Id="NFe${key}" versao="4.00"><ide>${ide}</ide>${emit}${dest}${xmlItems}<total>${icmsTot}</total>${pag}</infNFe></NFe>`;
 return {xml:root,key,number,series,cNF,dhEmi,total,items,environment,tpEmis};
}
function addQrCode(signedXml,doc,settings){
 const dom=new DOMParser().parseFromString(signedXml,'text/xml');const sig=dom.getElementsByTagName('Signature')[0];const dig=sig?sig.getElementsByTagName('DigestValue')[0]?.textContent:'';const tpAmb=doc.environment==='producao'?'1':'2';const cDest=digits(doc.customer_document||'');const dhHex=Buffer.from(doc.dhEmi,'utf8').toString('hex');const digHex=Buffer.from(dig||sha1b64(signedXml),'utf8').toString('hex');const cscId=pad(settings.fiscal_csc_id||'',6);let url,hash;
 if(Number(doc.tpEmis)===9){
   const day=String(new Date(doc.dhEmi).getDate()).padStart(2,'0');
   const params=[doc.key,'100',tpAmb,day,num(doc.total),digHex,cscId];
   const hashInput=params.join('|')+'|'+String(settings.fiscal_csc_token||'');hash=sha1hex(hashInput);url=SERVICE[doc.environment].qrcode+'?p='+params.join('|')+'|'+hash;
 }else{
   const base=[`chNFe=${doc.key}`,`nVersao=100`,`tpAmb=${tpAmb}`];if(cDest)base.push(`cDest=${cDest}`);base.push(`dhEmi=${dhHex}`,`vNF=${num(doc.total)}`,`vICMS=0.00`,`digVal=${digHex}`,`cIdToken=${cscId}`);hash=sha1hex(base.join('&')+'&CSC='+String(settings.fiscal_csc_token||''));url=SERVICE[doc.environment].qrcode+'?'+base.join('&')+'&cHashQRCode='+hash;
 }
 const supl=dom.createElementNS(NS_NFE,'infNFeSupl');const qr=dom.createElementNS(NS_NFE,'qrCode');qr.appendChild(dom.createCDATASection(url));const urlTag=dom.createElementNS(NS_NFE,'urlChave');urlTag.appendChild(dom.createTextNode(SERVICE[doc.environment].qrcode));supl.appendChild(qr);supl.appendChild(urlTag);dom.documentElement.appendChild(supl);return {xml:new XMLSerializer().serializeToString(dom),url,hash,digVal:dig};
}
function makeBatch(signed){return `<enviNFe xmlns="${NS_NFE}" versao="4.00"><idLote>${Date.now().toString().slice(-15)}</idLote><indSinc>1</indSinc>${signed.replace(/^<\?xml[^>]*\?>/,'')}</enviNFe>`;}
async function authorize(doc,settings,cert){const batch=makeBatch(doc.signedXml);const env=soapEnvelope('NFeAutorizacao4',batch);const r=await requestXml(SERVICE[doc.environment].authorize,'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote',env,settings.fiscal_cert_path,settings.__certPassword);return parseResponse(r.body);}
async function eventCancel(doc,settings,cert,justification){const dh=localIso();const id='ID110111'+doc.key+'01';const det=`<detEvento versaoEvento="1.00"><descEvento>Cancelamento</descEvento><nProt>${esc(doc.protocol||'')}</nProt><xJust>${esc(justification)}</xJust></detEvento>`;let xml=`<?xml version="1.0" encoding="UTF-8"?><envEvento xmlns="${NS_NFE}" versao="1.00"><idLote>${Date.now().toString().slice(-15)}</idLote><evento xmlns="${NS_NFE}" versao="1.00"><infEvento Id="${id}">${tag('cOrgao','35')}${tag('tpAmb',doc.environment==='producao'?'1':'2')}${tag('CNPJ',digits(settings.company_cnpj))}${tag('chNFe',doc.key)}${tag('dhEvento',dh)}${tag('tpEvento','110111')}${tag('nSeqEvento','1')}${det}</infEvento></evento></envEvento>`;xml=signXml(xml,id,cert,"//*[local-name(.)='infEvento']");const env=soapEnvelope('NFeRecepcaoEvento4',xml,'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4','1.00');const r=await requestXml(SERVICE[doc.environment].event,'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento',env,settings.fiscal_cert_path,settings.__certPassword);return parseResponse(r.body);}
async function status(settings){const xml=`<consStatServ xmlns="${NS_NFE}" versao="4.00"><tpAmb>${settings.fiscal_environment==='producao'?'1':'2'}</tpAmb><cUF>35</cUF><xServ>STATUS</xServ></consStatServ>`;const env=soapEnvelope('NFeStatusServico4',xml,'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4','4.00');const r=await requestXml(SERVICE[settings.fiscal_environment].status,'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF',env,settings.fiscal_cert_path,settings.__certPassword);return parseResponse(r.body);}
async function certificateInfo(settings){if(!settings.fiscal_cert_path)throw new Error('Selecione o certificado A1 (.pfx/.p12).');const cert=loadPfx(settings.fiscal_cert_path,settings.__certPassword||'');return {subject:cert.subject,serial:cert.serial,validFrom:cert.validFrom.toISOString(),validTo:cert.validTo.toISOString(),path:settings.fiscal_cert_path};}
function buildDanfeHtml(doc,qrData,settings){const rows=doc.items.map((i,n)=>`<tr><td>${n+1}</td><td>${esc(i.name)}</td><td>${i.quantity}</td><td>${num(i.unit_price_cents/100)}</td><td>${num(i.total_cents/100)}</td></tr>`).join('');return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:80mm auto;margin:3mm}body{font-family:Arial,sans-serif;width:74mm;font-size:10px;margin:0;color:#111}h1,h2,p{margin:2px 0}.c{text-align:center}.line{border-top:1px dashed #111;margin:5px 0}.small{font-size:8px}.qr{width:48mm;height:48mm}.items{width:100%;border-collapse:collapse;font-size:8px}.items td{padding:2px;border-bottom:1px dotted #bbb}.items th{font-size:8px}.tot{font-size:12px;font-weight:bold;text-align:right}.mono{font-family:monospace;font-size:7px;word-break:break-all}</style></head><body><div class="c"><h2>${esc(settings.company_fantasy_name||settings.store_name)}</h2><p>${esc(settings.company_legal_name||'')}</p><p>CNPJ ${esc(settings.company_cnpj||'')} · IE ${esc(settings.company_ie||'')}</p><p>${esc(settings.company_address||'')}</p><div class="line"></div><h3>DANFE NFC-e</h3><p>Nº ${doc.number} Série ${doc.series}</p><p>${doc.environment==='producao'?'AMBIENTE DE PRODUÇÃO':'AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL'}</p></div><div class="line"></div><table class="items"><thead><tr><th>#</th><th>Produto</th><th>Qtd</th><th>Unit.</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="line"></div><div class="tot">TOTAL R$ ${num(doc.total)}</div><p>Forma de pagamento: ${esc(doc.paymentLabel||'')}</p>${doc.protocol?`<p>Protocolo de autorização: ${esc(doc.protocol)}</p>`:''}<p class="mono">Chave: ${doc.key}</p><div class="c"><img class="qr" src="${qrData}"/><p>Consulte pela chave ou QR Code</p></div><div class="line"></div><p class="c small">Nota Fiscal de Consumidor Eletrônica</p></body></html>`;}
async function qrDataUrl(url){return QRCode.toDataURL(url,{errorCorrectionLevel:'M',margin:1,width:360});}
module.exports={SERVICE,loadPfx,signXml,buildNfce,addQrCode,authorize,eventCancel,status,certificateInfo,qrDataUrl,buildDanfeHtml,accessKey};
