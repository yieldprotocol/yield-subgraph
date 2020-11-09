import { FYDai, Transfer } from "../generated/templates/FYDai/FYDai"
import { Maturity } from "../generated/schema"
import { EIGHTEEN_DECIMALS } from './lib'

export function handleTransfer(event: Transfer): void {
  let fyDaiContract = FYDai.bind(event.address)
  let entity = Maturity.load(fyDaiContract.maturity().toString())

  entity.totalSupply = fyDaiContract
    .totalSupply()
    .toBigDecimal()
    .div(EIGHTEEN_DECIMALS)

  entity.save()
}
