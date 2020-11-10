import { Address, BigInt, BigDecimal, log } from "@graphprotocol/graph-ts"
import { Pool, Trade as TradeEvent, Liquidity } from "../generated/templates/Pool/Pool"
import { YieldMathWrapper } from "../generated/templates/Pool/YieldMathWrapper"
import { FYDai, Yield, Trade } from "../generated/schema"
import { EIGHTEEN_DECIMALS, EIGHTEEN_ZEROS, ZERO } from './lib'

let yieldMathAddress = Address.fromString('0xfcb06dce37a98081900fac325255d92dff94a107')
let yieldMath = YieldMathWrapper.bind(yieldMathAddress)
let k = BigInt.fromI32(0)
let g1 = BigInt.fromI32(0)
let g2 = BigInt.fromI32(0)
let gNoFee = BigInt.fromI32(2).pow(64)

function setupConstants(pool: Pool): void {
  if (k == BigInt.fromI32(0)) {
    k = pool.k()
    g1 = pool.g1()
    g2 = pool.g2()
  }
}

function yieldMathContractExists(): boolean {
  let result = yieldMath.try_daiInForFYDaiOut(ZERO, ZERO, ZERO, ZERO, ZERO, ZERO)
  return !result.reverted
}

function getFee(fyDaiReserves: BigInt, daiReserves: BigInt, timeTillMaturity: BigInt, fyDai: BigInt): BigDecimal {
  if (!yieldMathContractExists()) {
    log.warning("Can't find YieldMath, returning fee of 0", [])
    return ZERO.toBigDecimal()
  }

  let fee = ZERO
  if (fyDai >= ZERO) {
    let daiWithFee = yieldMath.daiInForFYDaiOut(daiReserves, fyDaiReserves, fyDai, timeTillMaturity, k, g1)
    let daiWithoutFee = yieldMath.daiInForFYDaiOut(daiReserves, fyDaiReserves, fyDai, timeTillMaturity, k, gNoFee)
    fee = daiWithFee.value1 - daiWithoutFee.value1
  } else {
    let daiWithFee = yieldMath.daiOutForFYDaiIn(daiReserves, fyDaiReserves, -fyDai, timeTillMaturity, k, g2)
    let daiWithoutFee = yieldMath.daiOutForFYDaiIn(daiReserves, fyDaiReserves, -fyDai, timeTillMaturity, k, gNoFee)
    fee = daiWithoutFee.value1 - daiWithFee.value1
  }
  return fee.divDecimal(EIGHTEEN_DECIMALS)
}


function getFYDaiFromPool(poolAddress: Address): FYDai {
  let poolContract = Pool.bind(poolAddress)
  let maturity = FYDai.load(poolContract.maturity().toString())
  return maturity!
}

function updateFYDai(maturity: FYDai, pool: Pool, timestamp: BigInt): void {
  maturity.poolFYDaiReservesWei = pool.getFYDaiReserves()
  maturity.poolFYDaiReserves = maturity.poolFYDaiReservesWei.toBigDecimal().div(EIGHTEEN_DECIMALS)
  maturity.poolDaiReservesWei = pool.getDaiReserves()
  maturity.poolDaiReserves = maturity.poolDaiReservesWei.toBigDecimal().div(EIGHTEEN_DECIMALS)

  let fyDaiPriceInDaiWei: BigInt
  if (maturity.maturity < timestamp) {
    fyDaiPriceInDaiWei = EIGHTEEN_ZEROS
  } else {
    let buyPriceResult = pool.try_buyFYDaiPreview(BigInt.fromI32(10).pow(16))

    if (buyPriceResult.reverted) {
      fyDaiPriceInDaiWei = BigInt.fromI32(0)
    } else {
      fyDaiPriceInDaiWei = buyPriceResult.value * BigInt.fromI32(100)
    }
  }
  maturity.currentFYDaiPriceInDai = fyDaiPriceInDaiWei.toBigDecimal().div(EIGHTEEN_DECIMALS)
}

export function handleTrade(event: TradeEvent): void {
  let pool = Pool.bind(event.address)
  let maturity = getFYDaiFromPool(event.address)

  let daiVolume = event.params.daiTokens.toBigDecimal().div(EIGHTEEN_DECIMALS)
  if (daiVolume.lt(BigInt.fromI32(0).toBigDecimal())) {
    daiVolume = daiVolume.neg()
  }

  // Create Trade entity
  let trade = new Trade(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
  trade.fyDai = maturity.id
  trade.from = event.params.from
  trade.to = event.params.to
  trade.amountDai = event.params.daiTokens.divDecimal(EIGHTEEN_DECIMALS)
  trade.amountFYDai = event.params.fyDaiTokens.divDecimal(EIGHTEEN_DECIMALS)

  setupConstants(pool)
  let timeTillMaturity = maturity.maturity - event.block.timestamp
  trade.feeInDai = getFee(maturity.poolFYDaiReservesWei, maturity.poolDaiReservesWei, timeTillMaturity, event.params.fyDaiTokens)

  // Update global stats
  let yieldSingleton = Yield.load('1')
  yieldSingleton.totalVolumeDai += daiVolume
  yieldSingleton.totalTradingFeesInDai += trade.feeInDai

  // Update maturity
  maturity.totalVolumeDai += daiVolume
  maturity.totalTradingFeesInDai += trade.feeInDai
  updateFYDai(maturity, pool, event.block.timestamp)

  maturity.save()
  yieldSingleton.save()
  trade.save()
}

export function handleLiquidity(event: Liquidity): void {
  let maturity = getFYDaiFromPool(event.address)
  let pool = Pool.bind(event.address)

  updateFYDai(maturity, pool, event.block.timestamp)

  maturity.save()
}
