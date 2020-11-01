import { BigInt } from "@graphprotocol/graph-ts"
import { Migrations, Registered } from "../generated/Migrations/Migrations"
import { Maturity, Pool } from "../generated/schema"
import { FYDai } from "../generated/templates/FYDai/FYDai"
import { Pool as PoolContract } from "../generated/templates/Pool/Pool"
import { FYDai as FYDaiTemplate, Pool as PoolTemplate, Controller } from '../generated/templates'

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

export function handleRegistered(event: Registered): void {
  let contractType = getContractType(event.params.name.toString())

  if (contractType == ContractType.SERIES) {
    let seriesContract = FYDai.bind(event.params.addr)

    let series = new Maturity(event.params.addr.toHex())
    series.name = seriesContract.name()
    series.symbol = seriesContract.symbol()
    series.maturity = seriesContract.maturity()
    series.totalSupply = BigInt.fromI32(0).toBigDecimal()

    series.save()

    FYDaiTemplate.create(event.params.addr)
  }

  if (contractType == ContractType.POOL) {
    let poolContract = PoolContract.bind(event.params.addr)

    let pool = new Pool(event.params.addr.toHex())
    pool.maturity = poolContract.fyDai().toHex()
    pool.totalVolumeDai = BigInt.fromI32(0).toBigDecimal()

    pool.save()

    PoolTemplate.create(event.params.addr)
  }

  if (contractType == ContractType.CONTROLLER) {
    Controller.create(event.params.addr)
  }
}
