import { BigInt, BigDecimal } from '@graphprotocol/graph-ts'

export let EIGHTEEN_DECIMALS: BigDecimal = BigInt.fromI32(10).pow(18).toBigDecimal()
