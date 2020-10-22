import { BigInt } from "@graphprotocol/graph-ts"
import { Migrations, Registered } from "../generated/Migrations/Migrations"
import { Maturity } from "../generated/schema"
import { FYDai } from "../generated/templates/FYDai/FYDai"
import { FYDai as FYDaiTemplate } from '../generated/templates'

// export function handleOwnershipTransferred(event: OwnershipTransferred): void {
//   // Entities can be loaded from the store using a string ID; this ID
//   // needs to be unique across all entities of the same type
//   let entity = ExampleEntity.load(event.transaction.from.toHex())

//   // Entities only exist after they have been saved to the store;
//   // `null` checks allow to create entities on demand
//   if (entity == null) {
//     entity = new ExampleEntity(event.transaction.from.toHex())

//     // Entity fields can be set using simple assignments
//     entity.count = BigInt.fromI32(0)
//   }

//   // BigInt and BigDecimal math are supported
//   entity.count = entity.count + BigInt.fromI32(1)

//   // Entity fields can be set based on event parameters
//   entity.previousOwner = event.params.previousOwner
//   entity.newOwner = event.params.newOwner

//   // Entities can be written to the store with `.save()`
//   entity.save()

//   // Note: If a handler doesn't require existing field values, it is faster
//   // _not_ to load the entity from the store. Instead, create it fresh with
//   // `new Entity(...)`, set the fields that should be updated and save the
//   // entity back to the store. Fields that were not set or unset remain
//   // unchanged, allowing for partial updates to be applied.

//   // It is also possible to access smart contracts from mappings. For
//   // example, the contract that has emitted the event can be connected to
//   // with:
//   //
//   // let contract = Contract.bind(event.address)
//   //
//   // The following functions can then be called on this contract to access
//   // state variables and other data:
//   //
//   // - contract.contracts(...)
//   // - contract.lastCompletedMigration(...)
//   // - contract.length(...)
//   // - contract.names(...)
//   // - contract.owner(...)
//   // - contract.version(...)
// }

enum ContractType {
  OTHER,
  SERIES,
  POOL,
}

function getContractType(name: string): ContractType {
  if (name.startsWith('fyDaiLP')) {
    return ContractType.POOL
  }
  if (name.startsWith('fyDai')) {
    return ContractType.SERIES
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
}
