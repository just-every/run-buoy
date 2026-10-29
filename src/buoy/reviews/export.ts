import {PDFDocument,PDFName,PDFString,rgb} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import fontDataUrl from './fonts/DejaVuSans.ttf?inline'
import pptxgen from 'pptxgenjs'
import {insist} from '../core'
import type {ReviewDocument} from './index'
const chunks=<T>(items:T[],n:number)=>Array.from({length:Math.ceil(items.length/n)},(_,i)=>items.slice(i*n,(i+1)*n))
export async function exportPowerPoint(doc:ReviewDocument,origin:string){
 const deck=new pptxgen();deck.layout='LAYOUT_WIDE';deck.author='Buoy';deck.subject=doc.interpretation;deck.title=doc.name
 for(const source of doc.slides)for(const [index,facts]of chunks(source.facts,4).entries()){
  const slide=deck.addSlide();slide.addText(source.title+(index?' (continued)':''),{x:.5,y:.3,w:12.3,h:.6,fontSize:24,bold:true,breakLine:false})
  slide.addText(source.commentary,{x:.5,y:1,w:12.3,h:1,fontSize:14,breakLine:false,fit:'shrink'})
  facts.forEach((fact,i)=>{slide.addText(fact.label+': '+fact.value,{x:.5,y:2+i*1.05,w:12.3,h:.5,fontSize:14,bold:true,fit:'shrink'});slide.addText('Source: '+fact.source,{x:.5,y:2.5+i*1.05,w:12.3,h:.45,fontSize:11,hyperlink:{url:new URL(fact.href,origin).href},fit:'shrink'})})
  slide.addText('Captured '+doc.capturedAt+' | UTC review window '+doc.start+' through '+doc.end+' | Current retained facts; no customer send.',{x:.5,y:6.85,w:12.3,h:.35,fontSize:9})
  slide.addNotes(doc.interpretation+'\n'+source.facts.map(f=>f.label+': '+f.value+'\n'+f.source+'\n'+new URL(f.href,origin).href).join('\n'))
 }
 return await deck.write({outputType:'uint8array',compression:true}) as Uint8Array
}
export async function exportPdf(doc:ReviewDocument,origin:string){
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit)
 const bytes=Uint8Array.from(atob(fontDataUrl.slice(fontDataUrl.indexOf(',')+1)),c=>c.charCodeAt(0))
 const font=await pdf.embedFont(bytes,{subset:true,features:{liga:false}}),coverage=new Set(font.getCharacterSet())
 pdf.setTitle(doc.name);pdf.setAuthor('Buoy')
 const safe=(text:string)=>{
  for(const character of text){
   if(/\s/u.test(character))continue
   const code=character.codePointAt(0)!
   insist(coverage.has(code)&&/[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Common}\p{Script=Inherited}]/u.test(character),'The PDF supports Latin, Greek and Cyrillic text and the bundled DejaVu Sans symbols. Unsupported character U+'+code.toString(16).toUpperCase()+'. Use PowerPoint for other scripts.')
  }
  return text
 }
 const graphemes=new Intl.Segmenter(undefined,{granularity:'grapheme'})
 const wrap=(value:string,size:number)=>{
  const lines:string[]=[]
  for(const paragraph of safe(value).replace(/\r\n?|[\u2028\u2029]/g,'\n').replace(/\t/g,'    ').split('\n')){
   let current=''
   for(const word of paragraph.match(/\S+[^\S\n]*|[^\S\n]+/gu)??[]){
    if(current&&font.widthOfTextAtSize(current+word.trimEnd(),size)>770){lines.push(current.trimEnd());current=''}
    for(const {segment}of graphemes.segment(word)){
     if(current&&font.widthOfTextAtSize(current+segment,size)>770){lines.push(current.trimEnd());current=''}
     current+=segment
    }
   }
   lines.push(current.trimEnd())
  }
  return lines
 }
 for(const source of doc.slides){
  let page=pdf.addPage([842,595]),y=560,annotations:ReturnType<typeof pdf.context.register>[]=[]
  const footer=()=>{page.drawText('Captured '+doc.capturedAt+' | '+doc.start+' through '+doc.end+' UTC',{x:32,y:20,size:8,font});if(annotations.length)page.node.set(PDFName.of('Annots'),pdf.context.obj(annotations))}
  const line=(value:string,size=11,href?:string)=>{for(const text of wrap(value,size)){if(y<size+45){footer();page=pdf.addPage([842,595]);annotations=[];y=560}page.drawText(text,{x:32,y,size,font,color:href?rgb(0,.25,.4):rgb(0,0,0)});if(href)annotations.push(pdf.context.register(pdf.context.obj({Type:'Annot',Subtype:'Link',Rect:[32,y-2,32+font.widthOfTextAtSize(text,size),y+size],Border:[0,0,0],A:{Type:'Action',S:'URI',URI:PDFString.of(new URL(href,origin).href)}})));y-=size+5}}
  line(source.title,19);line(source.commentary);y-=8
  for(const fact of source.facts){line(fact.label+': '+fact.value,12);line('Source: '+fact.source,9,fact.href);y-=8}
  line(doc.interpretation,9);footer()
 }
 return pdf.save()
}
