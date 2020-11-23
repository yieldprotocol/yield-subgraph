import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
import { Migrations, Registered } from "../generated/Migrations/Migrations"
import { FYDai, Yield } from "../generated/schema"
import { FYDai as FYDaiContract } from "../generated/templates/FYDai/FYDai"
import { Pool as PoolContract } from "../generated/templates/Pool/Pool"
import { FYDai as FYDaiTemplate, Pool as PoolTemplate, Controller } from '../generated/templates'
import { ZERO } from './lib'

enum ContractType {
  OTHER,
  SERIES,
  POOL,
  CONTROLLER,
}

function getContractType(name: string): ContractType {
  if (name.startsWith('fyDaiLP')) {
    return ContractType.POOL
  }
  if (name.startsWith('fyDai')) {
    return ContractType.SERIES
  }
  if (name == 'Controller') {
    return ContractType.CONTROLLER
  }
  return ContractType.OTHER
}

function createYieldSingleton(): void {
  let yieldSingleton = Yield.load('1')
  if (yieldSingleton == null) {
    yieldSingleton = new Yield('1')
    yieldSingleton.totalVolumeDai = BigInt.fromI32(0).toBigDecimal()
    yieldSingleton.totalTradingFeesInDai = BigInt.fromI32(0).toBigDecimal()
    yieldSingleton.numVaults = ZERO

    yieldSingleton.collateralETH = BigInt.fromI32(0).toBigDecimal()
    yieldSingleton.collateralChai = BigInt.fromI32(0).toBigDecimal()
    yieldSingleton.totalPoolDai = ZERO.toBigDecimal()
    yieldSingleton.totalPoolFYDai = ZERO.toBigDecimal()
    yieldSingleton.poolTLVInDai = ZERO.toBigDecimal()
    yieldSingleton.totalFYDaiDebt = BigInt.fromI32(0).toBigDecimal()
    yieldSingleton.totalFYDaiDebtFromETH = BigInt.fromI32(0).toBigDecimal()
    yieldSingleton.totalFYDaiDebtFromChai = BigInt.fromI32(0).toBigDecimal()

    yieldSingleton.save()
  }
}

function getFYDai(maturityTime: BigInt, address: Address): FYDai {
  let maturity = FYDai.load(maturityTime.toString())
  if (!maturity) {
    maturity = new FYDai(maturityTime.toString())

    let maturityContract = FYDaiContract.bind(address)
    maturity.address = address
    maturity.name = maturityContract.name()
    maturity.symbol = maturityContract.symbol()
    maturity.maturity = maturityTime
    maturity.apr = '0'
    maturity.totalSupply = BigInt.fromI32(0).toBigDecimal()
    maturity.totalVolumeDai = BigInt.fromI32(0).toBigDecimal()
    maturity.totalTradingFeesInDai = BigInt.fromI32(0).toBigDecimal()
    maturity.poolFYDaiReserves = BigInt.fromI32(0).toBigDecimal()
    maturity.poolFYDaiValueInDai = ZERO.toBigDecimal()
    maturity.poolDaiReserves = BigInt.fromI32(0).toBigDecimal()
    maturity.poolFYDaiReservesWei = ZERO
    maturity.poolDaiReservesWei = ZERO
    maturity.currentFYDaiPriceInDai = BigInt.fromI32(0).toBigDecimal()
    maturity.numVaults = ZERO
  }
  return maturity!
}

export function handleRegistered(event: Registered): void {
  createYieldSingleton()

  let contractType = getContractType(event.params.name.toString())

  if (contractType == ContractType.SERIES) {
    let maturityContract = FYDaiContract.bind(event.params.addr)
    let maturity = getFYDai(maturityContract.maturity(), event.params.addr)
    maturity.save()

    FYDaiTemplate.create(event.params.addr)
  }

  if (contractType == ContractType.POOL) {
    let poolContract = PoolContract.bind(event.params.addr)

    let maturity = getFYDai(poolContract.maturity(), poolContract.fyDai())
    maturity.pool = event.params.addr
    maturity.save()

    PoolTemplate.create(event.params.addr)
  }

  if (contractType == ContractType.CONTROLLER) {
    Controller.create(event.params.addr)
  }
}
