import {parseFormula,type Expression} from '../fields/formula/parser'
import type {Definition} from '../fields/model'
function portfolio(node:Expression):boolean{
 if(node.kind==='call')return ['sum','avg','count'].includes(node.name)||node.args.some(portfolio)
 if(node.kind==='unary')return portfolio(node.operand)
 if(node.kind==='binary')return portfolio(node.left)||portfolio(node.right)
 return false
}
export const usesPortfolio=(definitions:Definition[])=>definitions.some(d=>!!d.formula&&portfolio(parseFormula(d.formula)))
