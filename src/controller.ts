import { Address, store, ByteArray, Bytes, BigInt, BigDecimal } from '@graphprotocol/graph-ts'
import { Controller, Posted, Borrowed } from "../generated/templates/Controller/Controller"
import { MakerPot } from "../generated/templates/Controller/MakerPot"
import { MakerMedianizer } from "../generated/templates/Controller/MakerMedianizer"
import { Vault, VaultFYDai, Yield, FYDai } from "../generated/schema"
import { EIGHTEEN_DECIMALS, ZERO, ONE } from './lib'
import { log } from '@graphprotocol/graph-ts'

let potAddress = Address.fromString('0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7')
let pot = MakerPot.bind(potAddress)
let medianizerAddress = Address.fromString('0x729D19f657BD0614b4985Cf1D82531c67569197B')
let medianizer = MakerMedianizer.bind(medianizerAddress)

function getVault(address: string, yieldSingleton: Yield): Vault {
  let account = Vault.load(address)

  if (!account) {
    account = new Vault(address)
    account.collateralETH = ZERO.toBigDecimal()
    account.collateralChai = ZERO.toBigDecimal()
    account.collateralChaiInDai = ZERO.toBigDecimal()
    account.totalFYDaiDebt = BigInt.fromI32(0).toBigDecimal()
    account.totalFYDaiDebtFromETH = BigInt.fromI32(0).toBigDecimal()
    account.totalFYDaiDebtFromChai = BigInt.fromI32(0).toBigDecimal()
    account.numFYDais = ZERO

    yieldSingleton.numVaults += ONE
  }

  return account!
}

function getVaultFYDai(vault: Vault, fyDai: FYDai): VaultFYDai {
  let id = vault.id + '-' + fyDai.id
  let vaultMaturity = VaultFYDai.load(id)

  if (!vaultMaturity) {
    vaultMaturity = new VaultFYDai(id)
    vaultMaturity.vault = vault.id
    vaultMaturity.fyDai = fyDai.id
    vaultMaturity.totalFYDaiDebt = ZERO.toBigDecimal()
    vaultMaturity.fyDaiDebtFromETH = ZERO.toBigDecimal()
    vaultMaturity.fyDaiDebtFromChai = ZERO.toBigDecimal()

    vault.numFYDais += ONE
    fyDai.numVaults += ONE
  }

  return vaultMaturity!
}

let TWENTY_SEVEN_DECIMALS = BigInt.fromI32(10).pow(27).toBigDecimal()
function getChaiPrice(): BigDecimal {
  return pot.chi().divDecimal(TWENTY_SEVEN_DECIMALS)
}

function getETHPrice(): BigDecimal {
  let priceInWei = BigInt.fromUnsignedBytes(medianizer.read().reverse() as Bytes)
  return priceInWei.divDecimal(EIGHTEEN_DECIMALS)
}

export function handlePosted(event: Posted): void {
  let yieldSingleton = Yield.load('1')!
  let account = getVault(event.params.user.toHex(), yieldSingleton)

  let controllerContract = Controller.bind(event.address)

  let collateralBalance = controllerContract
    .posted(event.params.collateral, event.params.user)
    .toBigDecimal()
    .div(EIGHTEEN_DECIMALS)

  if (event.params.collateral.toString() == 'ETH-A') {
    account.collateralETH = collateralBalance
    yieldSingleton.collateralETH += event.params.amount.divDecimal(EIGHTEEN_DECIMALS)

    yieldSingleton.ethPrice = getETHPrice()
    yieldSingleton.collateralETHInUSD = yieldSingleton.collateralETH * yieldSingleton.ethPrice
  }

  if (event.params.collateral.toString() == 'CHAI') {
    let chaiPriceInDai = getChaiPrice()

    account.collateralChai = collateralBalance
    account.collateralChaiInDai = account.collateralChaiInDai * chaiPriceInDai

    yieldSingleton.collateralChai += event.params.amount.divDecimal(EIGHTEEN_DECIMALS)
    yieldSingleton.collateralChaiInDai = yieldSingleton.collateralChai * chaiPriceInDai
  }

  account.save()
  yieldSingleton.save()
}

export function handleBorrowed(event: Borrowed): void {
  let yieldSingleton = Yield.load('1')!
  let account = getVault(event.params.user.toHex(), yieldSingleton)
  let fyDai = FYDai.load(event.params.maturity.toString())!
  let vaultMaturity = getVaultFYDai(account, fyDai)

  let controllerContract = Controller.bind(event.address)

  let borrowAmount = event.params.amount.divDecimal(EIGHTEEN_DECIMALS)

  account.totalFYDaiDebt += borrowAmount
  yieldSingleton.totalFYDaiDebt += borrowAmount

  if (event.params.collateral.toString() == 'ETH-A') {
    account.totalFYDaiDebtFromETH += borrowAmount
    yieldSingleton.totalFYDaiDebtFromETH += borrowAmount
  }

  if (event.params.collateral.toString() == 'CHAI') {
    account.totalFYDaiDebtFromChai += borrowAmount
    yieldSingleton.totalFYDaiDebtFromChai += borrowAmount
  }

  vaultMaturity.fyDaiDebtFromETH = controllerContract
    .debtFYDai(controllerContract.WETH(), event.params.maturity, event.params.user)
    .divDecimal(EIGHTEEN_DECIMALS)
  vaultMaturity.fyDaiDebtFromChai = controllerContract
    .debtFYDai(controllerContract.CHAI(), event.params.maturity, event.params.user)
    .divDecimal(EIGHTEEN_DECIMALS)
  vaultMaturity.totalFYDaiDebt = vaultMaturity.fyDaiDebtFromETH + vaultMaturity.fyDaiDebtFromChai

  // If a vaultMaturity has no outstanding debt, remove it
  if (vaultMaturity.totalFYDaiDebt == ZERO.toBigDecimal()) {
    store.remove('VaultFYDai', vaultMaturity.id)
    account.numFYDais -= ONE
    fyDai.numVaults -= ONE
  } else {
    vaultMaturity.save()
  }

  // If an vault has no loans, remove it
  if (account.numFYDais == ZERO) {
    store.remove('Vault', account.id)
    yieldSingleton.numVaults -= ONE
  } else {
    account.save()
  }

  yieldSingleton.save()
  fyDai.save()
}
