import { Address, BigInt, BigDecimal } from '@graphprotocol/graph-ts'
import { DSProxy } from "../generated/templates/Pool/DSProxy"

export let EIGHTEEN_ZEROS: BigInt = BigInt.fromI32(10).pow(18)

export let EIGHTEEN_DECIMALS: BigDecimal = BigInt.fromI32(10).pow(18).toBigDecimal()

export let ZERO: BigInt = BigInt.fromI32(0)
export let ONE: BigInt = BigInt.fromI32(1)

export function bigIntToFloat(num: BigInt, decimals: u8, percision: u8): f64 {
  return (num.div(BigInt.fromI32(10).pow(decimals - percision)).toI32() as f64) / Math.pow(10, percision)
}

export function getAccountAddress(address: Address): Address {
  let proxy = DSProxy.bind(address)
  let result = proxy.try_owner()
  if (result.reverted) {
    return address
  } else {
    return result.value
  }
}
