import { BigInt } from '@graphprotocol/graph-ts'
import { Controller, Posted } from "../generated/templates/Controller/Controller"
import { Account } from "../generated/schema"
import { EIGHTEEN_DECIMALS } from './lib'

let CHAI_COLLATERAL = "0x4348414900000000000000000000000000000000000000000000000000000000"
let WETH_COLLATERAL = "0x4554482d41000000000000000000000000000000000000000000000000000000"

export function handlePosted(event: Posted): void {
  let account = Account.load(event.params.user.toHex())

  if (!account) {
    account = new Account(event.params.user.toHex())
    account.collateralETH = BigInt.fromI32(0).toBigDecimal()
    account.collateralChai = BigInt.fromI32(0).toBigDecimal()
  }

  let controllerContract = Controller.bind(event.address)

  let collateralBalance = controllerContract
    .posted(event.params.collateral, event.params.user)
    .toBigDecimal()
    .div(EIGHTEEN_DECIMALS)

  if (event.params.collateral.toString() == 'ETH-A') {
    account.collateralETH = collateralBalance
  }

  if (event.params.collateral.toString() == 'CHAI') {
    account.collateralChai = collateralBalance
  }

  account.save()
}
