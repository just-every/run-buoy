import {parseFormula,fieldReferences,type Expression} from '../fields/formula/parser'
import type {Definition} from '../fields/model'
function portfolio(node:Expression):boolean{
 if(node.kind==='call')return ['sum','avg','count'].includes(node.name)||node.args.some(portfolio)
 if(node.kind==='unary')return portfolio(node.operand)
 if(node.kind==='binary')return portfolio(node.left)||portfolio(node.right)
 return false
}
export const usesPortfolio=(definitions:Definition[])=>definitions.some(d=>!!d.formula&&portfolio(parseFormula(d.formula)))

export function usesHierarchy(definitions:Definition[]){const visit=(node:Expression):boolean=>node.kind==='call'?/^(children|descendants)/.test(node.name)||node.args.some(visit):node.kind==='unary'?visit(node.operand):node.kind==='binary'?visit(node.left)||visit(node.right):false;return definitions.some(d=>!!d.formula&&visit(parseFormula(d.formula)))}

export const usesHierarchyPeople=(definitions:Definition[])=>definitions.some(d=>!!d.formula&&fieldReferences(parseFormula(d.formula)).includes('hierarchy.userCount'))
