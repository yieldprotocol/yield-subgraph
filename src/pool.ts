import { Address, BigInt } from "@graphprotocol/graph-ts"
import { Pool, Trade, Liquidity } from "../generated/templates/Pool/Pool"
import { Maturity, Yield } from "../generated/schema"
import { EIGHTEEN_DECIMALS } from './lib'

let ZERO = BigInt.fromI32(0).toBigDecimal()

function getMaturity(poolAddress: Address): Maturity {
  let poolContract = Pool.bind(poolAddress)
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

  let yieldSingleton = Yield.load('1')
  yieldSingleton.totalVolumeDai += daiVolume

  let pool = Pool.bind(event.address)

  maturity.poolFYDaiReserves = pool.getFYDaiReserves().toBigDecimal().div(EIGHTEEN_DECIMALS)
  maturity.poolDaiReserves = pool.getDaiReserves().toBigDecimal().div(EIGHTEEN_DECIMALS)

  maturity.save()
  yieldSingleton.save()
}

export function handleLiquidity(event: Liquidity): void {
  let maturity = getMaturity(event.address)

  let pool = Pool.bind(event.address)

  maturity.poolFYDaiReserves = pool.getFYDaiReserves().toBigDecimal().div(EIGHTEEN_DECIMALS)
  maturity.poolDaiReserves = pool.getDaiReserves().toBigDecimal().div(EIGHTEEN_DECIMALS)

  maturity.save()
}
