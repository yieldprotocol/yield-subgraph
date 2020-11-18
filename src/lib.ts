import { BigInt, BigDecimal } from '@graphprotocol/graph-ts'

export let EIGHTEEN_ZEROS: BigInt = BigInt.fromI32(10).pow(18)

export let EIGHTEEN_DECIMALS: BigDecimal = BigInt.fromI32(10).pow(18).toBigDecimal()

export let ZERO: BigInt = BigInt.fromI32(0)
export let ONE: BigInt = BigInt.fromI32(1)

export function bigIntToFloat(num: BigInt, decimals: u8, percision: u8): f64 {
  return (num.div(BigInt.fromI32(10).pow(decimals - percision)).toI32() as f64) / Math.pow(10, percision)
}
