import { BigDecimal } from '@graphprotocol/graph-ts'

export function exponentToBigDecimal(decimals: i32): BigDecimal {
  let bd = BigDecimal.fromString('1')
  for (let i = 0; i < decimals; i++) {
    bd = bd.times(BigDecimal.fromString('10'))
  }
  return bd
}

export let EIGHTEEN_DECIMALS: BigDecimal = exponentToBigDecimal(18)
