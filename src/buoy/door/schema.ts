import type {JsonSchemaObject} from '../../modules/agent-door/index.ts'
export const string={type:'string',minLength:1,maxLength:1000} as const
export const identifier={type:'string',minLength:1,maxLength:100} as const
export function objectSchema(properties:JsonSchemaObject['properties'],required:string[]=[]):JsonSchemaObject{
 return {type:'object',properties,required,additionalProperties:false}
}
export const proposalOutput=objectSchema({id:identifier,accountId:identifier,kind:{enum:['playbook','renewal']},payload:{type:'object'},status:{const:'prepared'}},['id','accountId','kind','payload','status'])
export const experimentOutput={type:'object',required:['id','revision','status'],properties:{id:identifier,revision:string,status:{enum:['proposed','approved']}}}
