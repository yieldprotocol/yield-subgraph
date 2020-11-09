import { store, ByteArray, BigInt } from '@graphprotocol/graph-ts'
import { Controller, Posted, Borrowed } from "../generated/templates/Controller/Controller"
import { Vault, VaultMaturity } from "../generated/schema"
import { EIGHTEEN_DECIMALS, ZERO } from './lib'

function getVault(address: string): Vault {
  let account = Vault.load(address)

  if (!account) {
    account = new Vault(address)
    account.collateralETH = BigInt.fromI32(0).toBigDecimal()
    account.collateralChai = BigInt.fromI32(0).toBigDecimal()
    account.totalFYDaiDebt = BigInt.fromI32(0).toBigDecimal()
    account.totalFYDaiDebtFromETH = BigInt.fromI32(0).toBigDecimal()
    account.totalFYDaiDebtFromChai = BigInt.fromI32(0).toBigDecimal()
  }

  return account!
}

function getVaultMaturity(vault: string, maturity: string): VaultMaturity {
  let id = vault + '-' + maturity
  let vaultMaturity = VaultMaturity.load(id)

  if (!vaultMaturity) {
    vaultMaturity = new VaultMaturity(id)
    vaultMaturity.vault = vault
    vaultMaturity.maturity = maturity
    vaultMaturity.totalFYDaiDebt = ZERO.toBigDecimal()
    vaultMaturity.fyDaiDebtFromETH = ZERO.toBigDecimal()
    vaultMaturity.fyDaiDebtFromChai = ZERO.toBigDecimal()
  }

  return vaultMaturity!
}

export function handlePosted(event: Posted): void {
  let account = getVault(event.params.user.toHex())

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
  let account = getVault(event.params.user.toHex())
  let vaultMaturity = getVaultMaturity(event.params.user.toHex(), event.params.maturity.toString())

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

  vaultMaturity.fyDaiDebtFromETH = controllerContract
    .debtFYDai(controllerContract.WETH(), event.params.maturity, event.params.user)
    .divDecimal(EIGHTEEN_DECIMALS)
  vaultMaturity.fyDaiDebtFromChai = controllerContract
    .debtFYDai(controllerContract.CHAI(), event.params.maturity, event.params.user)
    .divDecimal(EIGHTEEN_DECIMALS)
  vaultMaturity.totalFYDaiDebt = vaultMaturity.fyDaiDebtFromETH + vaultMaturity.fyDaiDebtFromChai

  account.save()
  vaultMaturity.save()
}
