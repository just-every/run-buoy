import assert from 'node:assert/strict'
import {scriptedQuestions} from './ai-question-edge.mjs'
import {submit} from './a11y-checks.mjs'

export async function scriptedQuestionBrowser({fixture,page,person,api,proof}){
 for(const accountId of ['synthetic-buoy-8002','synthetic-buoy-8020'])await api('/accounts/'+accountId+'/owner','PUT',{ownerId:person.id})
 fixture.setScripted(true)
 try{
  for(const role of ['csm','support']){
   await api('/roles/assignments','PUT',{revision:(await api('/roles')).revision,personId:person.id,roleId:role,scope:{kind:'own'}})
   for(const generated of [false,true])for(const [index,question] of scriptedQuestions.entries()){
    await page.goto(fixture.app.origin+'/app/ai',{waitUntil:'networkidle'})
    const form=page.locator('#ai-question')
    await form.getByLabel('Question',{exact:true}).fill(question)
    if(generated)await form.getByLabel('Generate an answer with supporting records',{exact:true}).check()
    await form.getByLabel('Send the selected permitted evidence for this request',{exact:true}).check()
    await submit(page,form.getByRole('button',{name:'Ask with citations',exact:true}))
    assert.equal(await page.getByRole('alert').count(),0)
    const result=page.locator('section').filter({has:page.getByRole('heading',{name:'Request result',exact:true})})
    const text=await result.innerText()
    assert.match(text,/executive contacts/);assert.doesNotMatch(text,/Outside Coastal/)
    if(generated){
     const expected=[['Harbour risk assessment: {"status":"at-risk"}'],['Next-quarter renewal: {"renewalDate":"2027-02-15"}'],[
      'Meeting preparation: {"name":"Visible Harbour"}','Meeting preparation: {"renewalDate":"2026-12-31"}','Meeting preparation: {"status":"at-risk"}',
      'Meeting preparation: {"name":"Selected Harbour"}','Meeting preparation: {"renewalDate":"2027-02-15"}','Meeting preparation: {"status":"at-risk"}',
     ],[],[]][index]
     assert.deepEqual(await result.locator('article > p').allTextContents(),expected)
     assert.equal(await result.locator('blockquote').count(),expected.length)
    }else{
     const expected=[['Visible Harbour'],['Selected Harbour'],['Visible Harbour','Selected Harbour'],[],[]][index]
     assert.deepEqual(await result.locator('a').allTextContents(),expected)
     if(index===1)assert.match(text,/renewal 2027-02-15/)
    }
    if(index===4)assert.match(text,generated?/detailed usage/:/detailed history/)
    await proof(role+'-'+(generated?'generated':'extractive')+'-question-'+index)
    const links=await result.locator('a').evaluateAll(nodes=>nodes.map(n=>({href:n.getAttribute('href'),label:n.textContent})))
    for(const link of links){
     const [destination]=await Promise.all([page.context().waitForEvent('page'),page.getByRole('link',{name:link.label,exact:true}).click({button:'middle'})])
     try{
      await destination.waitForLoadState('networkidle')
      assert.equal(new URL(destination.url()).pathname,new URL(link.href,fixture.app.origin).pathname)
      if(generated){const source=JSON.parse(await destination.locator('body').innerText());assert.equal(source.source.accountName,link.label.split(': ')[0])}
      else assert.equal(await destination.getByRole('heading',{name:link.label,exact:true,level:1}).count(),1)
     }finally{await destination.close()}
    }
   }
  }
 }finally{fixture.setScripted(false)}
}
