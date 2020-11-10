import { FYDai as FYDaiContract, Transfer } from "../generated/templates/FYDai/FYDai"
import { FYDai } from "../generated/schema"
import { EIGHTEEN_DECIMALS } from './lib'

export function handleTransfer(event: Transfer): void {
  let fyDaiContract = FYDaiContract.bind(event.address)
  let entity = FYDai.load(fyDaiContract.maturity().toString())

  entity.totalSupply = fyDaiContract
    .totalSupply()
    .toBigDecimal()
    .div(EIGHTEEN_DECIMALS)

  entity.save()
}
