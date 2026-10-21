// Consumer rules use today's real clock; the historic calculation fixture keeps
// its explicit report date. Deliver current events through the ordinary SDK.
export async function currentAdoption({sdk,people},tag){
 const timestamp=new Date().toISOString()
 for(const person of people){
  const accountIndex=person.accountId.replace('adoption-','')
  await sdk.track({messageId:`consumer-${tag}-${person.id}-${timestamp}`,userId:`user-${accountIndex}-${person.u}`,groupId:`group-${accountIndex}`,
   event:person.u%2?'File exported':'Report generated',timestamp})
 }
}
