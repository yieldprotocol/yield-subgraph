import { BigInt } from "@graphprotocol/graph-ts"
import { Pool, Trade } from "../generated/templates/Pool/Pool"
import { Pool } from "../generated/schema"
import { EIGHTEEN_DECIMALS } from './lib'

let ZERO = BigInt.fromI32(0).toBigDecimal()

export function handleTrade(event: Trade): void {
  let entity = Pool.load(event.address.toHex())

  let daiVolume = event.params.daiTokens.toBigDecimal().div(EIGHTEEN_DECIMALS)
  if (daiVolume.lt(BigInt.fromI32(0).toBigDecimal())) {
    daiVolume = daiVolume.neg()
  }

  entity.totalVolumeDai += daiVolume

  entity.save()
}
