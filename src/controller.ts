import { BigInt } from '@graphprotocol/graph-ts'
import { Controller, Posted, Borrowed } from "../generated/templates/Controller/Controller"
import { Account } from "../generated/schema"
import { EIGHTEEN_DECIMALS } from './lib'

function getAccount(address: string): Account {
  let account = Account.load(address)

  if (!account) {
    account = new Account(address)
    account.collateralETH = BigInt.fromI32(0).toBigDecimal()
    account.collateralChai = BigInt.fromI32(0).toBigDecimal()
    account.totalFYDaiDebt = BigInt.fromI32(0).toBigDecimal()
    account.totalFYDaiDebtFromETH = BigInt.fromI32(0).toBigDecimal()
    account.totalFYDaiDebtFromChai = BigInt.fromI32(0).toBigDecimal()
  }

  return account!
}

export function handlePosted(event: Posted): void {
  let account = getAccount(event.params.user.toHex())

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

export function handleBorrowed(event: Borrowed): void {
  let account = getAccount(event.params.user.toHex())

  let controllerContract = Controller.bind(event.address)

  let borrowAmount = event.params.amount
    .toBigDecimal()
    .div(EIGHTEEN_DECIMALS)

  account.totalFYDaiDebt += borrowAmount

  if (event.params.collateral.toString() == 'ETH-A') {
    account.totalFYDaiDebtFromETH += borrowAmount
  }

  if (event.params.collateral.toString() == 'CHAI') {
    account.totalFYDaiDebtFromChai += borrowAmount
  }

  account.save()
}
