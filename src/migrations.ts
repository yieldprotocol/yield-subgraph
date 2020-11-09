import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
import { Migrations, Registered } from "../generated/Migrations/Migrations"
import { Maturity, Yield } from "../generated/schema"
import { FYDai } from "../generated/templates/FYDai/FYDai"
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
    yieldSingleton.save()
  }
}

function getMaturity(maturityTime: BigInt, address: Address): Maturity {
  let maturity = Maturity.load(maturityTime.toString())
  if (!maturity) {
    maturity = new Maturity(maturityTime.toString())

    let maturityContract = FYDai.bind(address)
    maturity.name = maturityContract.name()
    maturity.symbol = maturityContract.symbol()
    maturity.maturity = maturityTime
    maturity.totalSupply = BigInt.fromI32(0).toBigDecimal()
    maturity.totalVolumeDai = BigInt.fromI32(0).toBigDecimal()
    maturity.totalTradingFeesInDai = BigInt.fromI32(0).toBigDecimal()
    maturity.poolFYDaiReserves = BigInt.fromI32(0).toBigDecimal()
    maturity.poolDaiReserves = BigInt.fromI32(0).toBigDecimal()
    maturity.poolFYDaiReservesWei = ZERO
    maturity.poolDaiReservesWei = ZERO
    maturity.currentFYDaiPriceInDai = BigInt.fromI32(0).toBigDecimal()
  }
  return maturity!
}

export function handleRegistered(event: Registered): void {
  createYieldSingleton()

  let contractType = getContractType(event.params.name.toString())

  if (contractType == ContractType.SERIES) {
    let maturityContract = FYDai.bind(event.params.addr)
    let maturity = getMaturity(maturityContract.maturity(), event.params.addr)
    maturity.save()

    FYDaiTemplate.create(event.params.addr)
  }

  if (contractType == ContractType.POOL) {
    let poolContract = PoolContract.bind(event.params.addr)

    let maturity = getMaturity(poolContract.maturity(), poolContract.fyDai())
    maturity.pool = event.params.addr
    maturity.save()

    PoolTemplate.create(event.params.addr)
  }

  if (contractType == ContractType.CONTROLLER) {
    Controller.create(event.params.addr)
  }
}
