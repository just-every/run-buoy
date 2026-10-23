import {PDFDocument,StandardFonts,PDFName,PDFString,rgb} from 'pdf-lib'
import pptxgen from 'pptxgenjs'
import {insist} from '../core'
import type {ReviewDocument,ReviewSlide} from './index'
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
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);pdf.setTitle(doc.name);pdf.setAuthor('Buoy')
 const safe=(text:string)=>{try{font.encodeText(text);return text}catch{insist(false,'This PDF font cannot represent a character in this deck. PowerPoint preserves Unicode; edit the text or use PowerPoint.')}}
 for(const source of doc.slides){
  let page=pdf.addPage([842,595]),y=560,annotations:ReturnType<typeof pdf.context.register>[]=[]
  const footer=()=>{page.drawText('Captured '+doc.capturedAt+' | '+doc.start+' through '+doc.end+' UTC',{x:32,y:20,size:8,font});if(annotations.length)page.node.set(PDFName.of('Annots'),pdf.context.obj(annotations))}
  const line=(value:string,size=11,href?:string)=>{const words=safe(value).replace(/\r/g,'').split(/\s+/),lines:string[]=[];let current='';for(const word of words){for(const part of word.match(/.{1,90}/g)??['']){if(font.widthOfTextAtSize((current?current+' ':'')+part,size)>770){lines.push(current);current=part}else current+=(current?' ':'')+part}}if(current)lines.push(current);for(const text of lines){if(y<size+45){footer();page=pdf.addPage([842,595]);annotations=[];y=560}page.drawText(text,{x:32,y,size,font,color:href?rgb(0,.25,.4):rgb(0,0,0)});if(href)annotations.push(pdf.context.register(pdf.context.obj({Type:'Annot',Subtype:'Link',Rect:[32,y-2,810,y+size],Border:[0,0,0],A:{Type:'Action',S:'URI',URI:PDFString.of(new URL(href,origin).href)}})));y-=size+5}}
  line(source.title,19);line(source.commentary);y-=8
  for(const fact of source.facts){line(fact.label+': '+fact.value,12);line('Source: '+fact.source,9,fact.href);y-=8}
  line(doc.interpretation,9);footer()
 }
 return pdf.save()
}
