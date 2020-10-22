// import { BigInt } from "@graphprotocol/graph-ts"
import { FYDai, Transfer } from "../generated/templates/FYDai/FYDai"
import { Maturity } from "../generated/schema"
import { EIGHTEEN_DECIMALS } from './lib'

export function handleTransfer(event: Transfer): void {
  let entity = Maturity.load(event.address.toHex())

  let fyDaiContract = FYDai.bind(event.address)

  entity.totalSupply = fyDaiContract
    .totalSupply()
    .toBigDecimal()
    .div(EIGHTEEN_DECIMALS)

  entity.save()
}
