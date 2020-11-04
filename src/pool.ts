import { Address, BigInt } from "@graphprotocol/graph-ts"
import { Pool, Trade } from "../generated/templates/Pool/Pool"
import { Maturity } from "../generated/schema"
import { Pool as PoolContract } from "../generated/templates/Pool/Pool"
import { EIGHTEEN_DECIMALS } from './lib'

let ZERO = BigInt.fromI32(0).toBigDecimal()

function getMaturity(poolAddress: Address): Maturity {
  let poolContract = PoolContract.bind(poolAddress)
  let maturity = Maturity.load(poolContract.fyDai().toHex())
  return maturity!
}

export function handleTrade(event: Trade): void {
  let maturity = getMaturity(event.address)

  let daiVolume = event.params.daiTokens.toBigDecimal().div(EIGHTEEN_DECIMALS)
  if (daiVolume.lt(BigInt.fromI32(0).toBigDecimal())) {
    daiVolume = daiVolume.neg()
  }

  maturity.totalVolumeDai += daiVolume

  maturity.save()
}
