import { Address, BigInt, BigDecimal, log } from "@graphprotocol/graph-ts"
import { FYDai as FYDaiContract } from "../generated/templates/Pool/FYDai"
import { Pool, Trade as TradeEvent, Liquidity as LiquidityEvent } from "../generated/templates/Pool/Pool"
import { FYDai, Yield, Trade, Liquidity } from "../generated/schema"
import { EIGHTEEN_DECIMALS, EIGHTEEN_ZEROS, ZERO, bigIntToFloat } from './lib'

let SECONDS_PER_YEAR: f64 = 365 * 24 * 60 * 60
let k = (1 as f64) / (4 * 365 * 24 * 60 * 60 as f64) // 1 / seconds in four years
let g1 = 950 as f64 / 1000 as f64
let g2 = 1000 as f64 / 950 as f64
let gNoFee: f64 = 1

function buyFYDai(fyDaiReserves: f64, daiReserves: f64, timeTillMaturity: i32, fyDai: f64, g: f64): f64 {
  let t = k * timeTillMaturity
  let a = 1 as f64 - (g * t)
  let Za = Math.pow(daiReserves, a)
  let Ya = Math.pow(fyDaiReserves, a)
  let Yxa = Math.pow(fyDaiReserves - fyDai, a)
  let y = Math.pow((Za + Ya) - Yxa, (1 as f64 / a)) - daiReserves

  return y
};

function sellFYDai(fyDaiReserves: f64, daiReserves: f64, timeTillMaturity: i32, fyDai: f64, g: f64): f64 {
  let t = k * timeTillMaturity
  let a = 1 as f64 - (g * t)
  let Za = Math.pow(daiReserves, a)
  let Ya = Math.pow(fyDaiReserves, a)
  let Yxa = Math.pow(fyDaiReserves + fyDai, a)
  let y = daiReserves - Math.pow(Za + (Ya - Yxa), (1 as f64 / a))

  return y
};

function getFee(fyDaiReserves: BigInt, daiReserves: BigInt, timeTillMaturity: BigInt, fyDai: BigInt): BigDecimal {
  let fyDaiReservesDecimal = bigIntToFloat(fyDaiReserves, 18, 2)
  let daiReservesDecimal = bigIntToFloat(daiReserves, 18, 2)
  let fyDaiDecimal = bigIntToFloat(fyDai, 18, 4)

  let fee: f64 = 0
  if (fyDai >= ZERO) {
    let daiWithFee = buyFYDai(fyDaiReservesDecimal, daiReservesDecimal, timeTillMaturity.toI32(), fyDaiDecimal, g1)
    let daiWithoutFee = buyFYDai(fyDaiReservesDecimal, daiReservesDecimal, timeTillMaturity.toI32(), fyDaiDecimal, gNoFee)
    fee = daiWithFee - daiWithoutFee
  } else {
    let daiWithFee = sellFYDai(fyDaiReservesDecimal, daiReservesDecimal, timeTillMaturity.toI32(), -fyDaiDecimal, g2)
    let daiWithoutFee = sellFYDai(fyDaiReservesDecimal, daiReservesDecimal, timeTillMaturity.toI32(), -fyDaiDecimal, gNoFee)
    fee = daiWithoutFee - daiWithFee
  }
  return BigDecimal.fromString(fee.toString())
}


function getFYDaiFromPool(poolAddress: Address): FYDai {
  let poolContract = Pool.bind(poolAddress)
  let maturity = FYDai.load(poolContract.maturity().toString())
  return maturity!
}

function updateFYDai(maturity: FYDai, pool: Pool, yieldSingleton: Yield, timestamp: BigInt): void {
  // Subtract the previous pool TLV. We'll add the updated value back after recalculating it
  yieldSingleton.poolTLVInDai -= (maturity.poolDaiReserves + maturity.poolFYDaiValueInDai)

  let fyDaiContract = FYDaiContract.bind(pool.fyDai())

  maturity.poolFYDaiReservesWei = fyDaiContract.balanceOf(pool._address)
  maturity.poolFYDaiReserves = maturity.poolFYDaiReservesWei.toBigDecimal().div(EIGHTEEN_DECIMALS)
  maturity.poolDaiReservesWei = pool.getDaiReserves()
  maturity.poolDaiReserves = maturity.poolDaiReservesWei.toBigDecimal().div(EIGHTEEN_DECIMALS)

  let fyDaiPriceInDaiWei: BigInt
  if (maturity.maturity < timestamp) {
    fyDaiPriceInDaiWei = EIGHTEEN_ZEROS
  } else {
    let buyPriceResult = pool.try_sellFYDaiPreview(BigInt.fromI32(10).pow(16))

    if (buyPriceResult.reverted) {
      fyDaiPriceInDaiWei = BigInt.fromI32(0)
    } else {
      fyDaiPriceInDaiWei = buyPriceResult.value * BigInt.fromI32(100)
    }
  }
  maturity.currentFYDaiPriceInDai = fyDaiPriceInDaiWei.toBigDecimal().div(EIGHTEEN_DECIMALS)

  maturity.poolFYDaiValueInDai = maturity.poolFYDaiReserves * maturity.currentFYDaiPriceInDai
  yieldSingleton.poolTLVInDai += (maturity.poolDaiReserves + maturity.poolFYDaiValueInDai)

  maturity.apr = yieldAPR(fyDaiPriceInDaiWei, maturity.maturity - timestamp)
}

// Adapted from https://github.com/yieldprotocol/fyDai-frontend/blob/master/src/hooks/mathHooks.ts#L219
function yieldAPR(fyDaiPriceInDaiWei: BigInt, timeTillMaturity: BigInt): string {
  let amount = EIGHTEEN_ZEROS

  if (timeTillMaturity < ZERO) {
    return '0'
  }

  let fyDaiPriceInDai: f64 = bigIntToFloat(fyDaiPriceInDaiWei, 18, 8)

  let propOfYear = (timeTillMaturity.toI32() as f64) / SECONDS_PER_YEAR
  let priceRatio = 1 / fyDaiPriceInDai
  let powRatio = 1 / propOfYear
  let apr = Math.pow(priceRatio, powRatio) - 1

  if (apr > 0 && apr < 100) {
    let aprPercent = apr * 100
    return aprPercent.toString()
  }
  return '0'
}

export function handleTrade(event: TradeEvent): void {
  let yieldSingleton = Yield.load('1')!
  let pool = Pool.bind(event.address)
  let maturity = getFYDaiFromPool(event.address)

  let daiVolume = event.params.daiTokens.toBigDecimal().div(EIGHTEEN_DECIMALS)
  if (daiVolume.lt(BigInt.fromI32(0).toBigDecimal())) {
    daiVolume = daiVolume.neg()
  }

  // Create Trade entity
  let trade = new Trade(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
  trade.timestamp = event.block.timestamp
  trade.fyDai = maturity.id
  trade.from = event.params.from
  trade.to = event.params.to
  trade.amountDai = event.params.daiTokens.divDecimal(EIGHTEEN_DECIMALS)
  trade.amountFYDai = event.params.fyDaiTokens.divDecimal(EIGHTEEN_DECIMALS)

  let timeTillMaturity = maturity.maturity - event.block.timestamp
  trade.feeInDai = getFee(maturity.poolFYDaiReservesWei, maturity.poolDaiReservesWei, timeTillMaturity, event.params.fyDaiTokens)

  // Update global stats
  yieldSingleton.totalVolumeDai += daiVolume
  yieldSingleton.totalTradingFeesInDai += trade.feeInDai
  yieldSingleton.totalPoolDai -= event.params.daiTokens.divDecimal(EIGHTEEN_DECIMALS)
  yieldSingleton.totalPoolFYDai -= event.params.fyDaiTokens.divDecimal(EIGHTEEN_DECIMALS)

  // Update maturity
  maturity.totalVolumeDai += daiVolume
  maturity.totalTradingFeesInDai += trade.feeInDai
  updateFYDai(maturity, pool, yieldSingleton, event.block.timestamp)

  maturity.save()
  yieldSingleton.save()
  trade.save()
}

export function handleLiquidity(event: LiquidityEvent): void {
  let yieldSingleton = Yield.load('1')!
  let fyDai = getFYDaiFromPool(event.address)
  let pool = Pool.bind(event.address)

  // Create Liquidity entity
  let liquidity = new Liquidity(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
  liquidity.timestamp = event.block.timestamp
  liquidity.fyDai = fyDai.id
  liquidity.from = event.params.from
  liquidity.to = event.params.to
  liquidity.amountDai = event.params.daiTokens.divDecimal(EIGHTEEN_DECIMALS)
  liquidity.amountFYDai = event.params.fyDaiTokens.divDecimal(EIGHTEEN_DECIMALS)

  updateFYDai(fyDai, pool, yieldSingleton, event.block.timestamp)

  yieldSingleton.totalPoolDai -= event.params.daiTokens.divDecimal(EIGHTEEN_DECIMALS)
  yieldSingleton.totalPoolFYDai -= event.params.fyDaiTokens.divDecimal(EIGHTEEN_DECIMALS)

  fyDai.save()
  liquidity.save()
  yieldSingleton.save()
}
