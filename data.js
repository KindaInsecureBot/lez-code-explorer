/* ============================================================
   LEZ Code Explorer — Source Files & Explanations
   ============================================================ */

/* ---- Source file registry ---- */
const SOURCE_FILES = [
  {
    id: 'token_core_lib',
    name: 'lib.rs',
    path: 'token/core/src/lib.rs',
    label: 'Token core data structures',
    program: 'token',
    content: `//! This crate contains core data structures and utilities for the Token Program.

use borsh::{BorshDeserialize, BorshSerialize};
use nssa_core::account::{AccountId, Data};
use serde::{Deserialize, Serialize};

/// Token Program Instruction.
#[derive(Serialize, Deserialize)]
pub enum Instruction {
    /// Transfer tokens from sender to recipient.
    ///
    /// Required accounts:
    /// - Sender's Token Holding account (authorized),
    /// - Recipient's Token Holding account.
    Transfer { amount_to_transfer: u128 },

    /// Create a new fungible token definition without metadata.
    ///
    /// Required accounts:
    /// - Token Definition account (uninitialized),
    /// - Token Holding account (uninitialized).
    NewFungibleDefinition { name: String, total_supply: u128 },

    /// Create a new fungible or non-fungible token definition with metadata.
    ///
    /// Required accounts:
    /// - Token Definition account (uninitialized),
    /// - Token Holding account (uninitialized),
    /// - Token Metadata account (uninitialized).
    NewDefinitionWithMetadata {
        new_definition: NewTokenDefinition,
        /// Boxed to avoid large enum variant size
        metadata: Box<NewTokenMetadata>,
    },

    /// Initialize a token holding account for a given token definition.
    ///
    /// Required accounts:
    /// - Token Definition account (initialized),
    /// - Token Holding account (uninitialized),
    InitializeAccount,

    /// Burn tokens from the holder's account.
    ///
    /// Required accounts:
    /// - Token Definition account (initialized),
    /// - Token Holding account (authorized).
    Burn { amount_to_burn: u128 },

    /// Mint new tokens to the holder's account.
    ///
    /// Required accounts:
    /// - Token Definition account (authorized),
    /// - Token Holding account (uninitialized or initialized).
    Mint { amount_to_mint: u128 },

    /// Print a new NFT from the master copy.
    ///
    /// Required accounts:
    /// - NFT Master Token Holding account (authorized),
    /// - NFT Printed Copy Token Holding account (uninitialized).
    PrintNft,
}

#[derive(Serialize, Deserialize)]
pub enum NewTokenDefinition {
    Fungible {
        name: String,
        total_supply: u128,
    },
    NonFungible {
        name: String,
        printable_supply: u128,
    },
}

#[derive(Debug, PartialEq, Eq, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub enum TokenDefinition {
    Fungible {
        name: String,
        total_supply: u128,
        metadata_id: Option<AccountId>,
    },
    NonFungible {
        name: String,
        printable_supply: u128,
        metadata_id: AccountId,
    },
}

impl TryFrom<&Data> for TokenDefinition {
    type Error = std::io::Error;

    fn try_from(data: &Data) -> Result<Self, Self::Error> {
        TokenDefinition::try_from_slice(data.as_ref())
    }
}

impl From<&TokenDefinition> for Data {
    fn from(definition: &TokenDefinition) -> Self {
        // Using size_of_val as size hint for Vec allocation
        let mut data = Vec::with_capacity(std::mem::size_of_val(definition));

        BorshSerialize::serialize(definition, &mut data)
            .expect("Serialization to Vec should not fail");

        Data::try_from(data).expect("Token definition encoded data should fit into Data")
    }
}

#[derive(Debug, PartialEq, Eq, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub enum TokenHolding {
    Fungible {
        definition_id: AccountId,
        balance: u128,
    },
    NftMaster {
        definition_id: AccountId,
        /// The amount of printed copies left - 1 (1 reserved for master copy itself).
        print_balance: u128,
    },
    NftPrintedCopy {
        definition_id: AccountId,
        /// Whether nft is owned by the holder.
        owned: bool,
    },
}

impl TokenHolding {
    pub fn zeroized_clone_from(other: &Self) -> Self {
        match other {
            TokenHolding::Fungible { definition_id, .. } => TokenHolding::Fungible {
                definition_id: *definition_id,
                balance: 0,
            },
            TokenHolding::NftMaster { definition_id, .. } => TokenHolding::NftMaster {
                definition_id: *definition_id,
                print_balance: 0,
            },
            TokenHolding::NftPrintedCopy { definition_id, .. } => TokenHolding::NftPrintedCopy {
                definition_id: *definition_id,
                owned: false,
            },
        }
    }

    pub fn zeroized_from_definition(
        definition_id: AccountId,
        definition: &TokenDefinition,
    ) -> Self {
        match definition {
            TokenDefinition::Fungible { .. } => TokenHolding::Fungible {
                definition_id,
                balance: 0,
            },
            TokenDefinition::NonFungible { .. } => TokenHolding::NftPrintedCopy {
                definition_id,
                owned: false,
            },
        }
    }

    pub fn definition_id(&self) -> AccountId {
        match self {
            TokenHolding::Fungible { definition_id, .. } => *definition_id,
            TokenHolding::NftMaster { definition_id, .. } => *definition_id,
            TokenHolding::NftPrintedCopy { definition_id, .. } => *definition_id,
        }
    }
}

impl TryFrom<&Data> for TokenHolding {
    type Error = std::io::Error;

    fn try_from(data: &Data) -> Result<Self, Self::Error> {
        TokenHolding::try_from_slice(data.as_ref())
    }
}

impl From<&TokenHolding> for Data {
    fn from(holding: &TokenHolding) -> Self {
        // Using size_of_val as size hint for Vec allocation
        let mut data = Vec::with_capacity(std::mem::size_of_val(holding));

        BorshSerialize::serialize(holding, &mut data)
            .expect("Serialization to Vec should not fail");

        Data::try_from(data).expect("Token holding encoded data should fit into Data")
    }
}

#[derive(Serialize, Deserialize)]
pub struct NewTokenMetadata {
    /// Metadata standard.
    pub standard: MetadataStandard,
    /// Pointer to off-chain metadata
    pub uri: String,
    /// Creators of the token.
    pub creators: String,
}

#[derive(Debug, PartialEq, Eq, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub struct TokenMetadata {
    /// Token Definition account id.
    pub definition_id: AccountId,
    /// Metadata standard .
    pub standard: MetadataStandard,
    /// Pointer to off-chain metadata.
    pub uri: String,
    /// Creators of the token.
    pub creators: String,
    /// Block id of primary sale.
    pub primary_sale_date: u64,
}

/// Metadata standard defining the expected format of JSON located off-chain.
#[derive(Debug, PartialEq, Eq, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub enum MetadataStandard {
    Simple,
    Expanded,
}

impl TryFrom<&Data> for TokenMetadata {
    type Error = std::io::Error;

    fn try_from(data: &Data) -> Result<Self, Self::Error> {
        TokenMetadata::try_from_slice(data.as_ref())
    }
}

impl From<&TokenMetadata> for Data {
    fn from(metadata: &TokenMetadata) -> Self {
        // Using size_of_val as size hint for Vec allocation
        let mut data = Vec::with_capacity(std::mem::size_of_val(metadata));

        BorshSerialize::serialize(metadata, &mut data)
            .expect("Serialization to Vec should not fail");

        Data::try_from(data).expect("Token metadata encoded data should fit into Data")
    }
}`
  },
  {
    id: 'token_src_lib',
    name: 'lib.rs',
    path: 'token/src/lib.rs',
    label: 'Token module exports',
    program: 'token',
    content: `//! The Token Program implementation.

pub use token_core as core;

pub mod burn;
pub mod initialize;
pub mod mint;
pub mod new_definition;
pub mod print_nft;
pub mod transfer;

mod tests;`
  },
  {
    id: 'token_burn',
    name: 'burn.rs',
    path: 'token/src/burn.rs',
    label: 'Burn tokens',
    program: 'token',
    content: `use nssa_core::{
    account::{AccountWithMetadata, Data},
    program::AccountPostState,
};
use token_core::{TokenDefinition, TokenHolding};

pub fn burn(
    definition_account: AccountWithMetadata,
    user_holding_account: AccountWithMetadata,
    amount_to_burn: u128,
) -> Vec<AccountPostState> {
    assert!(
        user_holding_account.is_authorized,
        "Authorization is missing"
    );

    let mut definition = TokenDefinition::try_from(&definition_account.account.data)
        .expect("Token Definition account must be valid");
    let mut holding = TokenHolding::try_from(&user_holding_account.account.data)
        .expect("Token Holding account must be valid");

    assert_eq!(
        definition_account.account_id,
        holding.definition_id(),
        "Mismatch Token Definition and Token Holding"
    );

    match (&mut definition, &mut holding) {
        (
            TokenDefinition::Fungible {
                name: _,
                metadata_id: _,
                total_supply,
            },
            TokenHolding::Fungible {
                definition_id: _,
                balance,
            },
        ) => {
            *balance = balance
                .checked_sub(amount_to_burn)
                .expect("Insufficient balance to burn");

            *total_supply = total_supply
                .checked_sub(amount_to_burn)
                .expect("Total supply underflow");
        }
        (
            TokenDefinition::NonFungible {
                name: _,
                printable_supply,
                metadata_id: _,
            },
            TokenHolding::NftMaster {
                definition_id: _,
                print_balance,
            },
        ) => {
            *printable_supply = printable_supply
                .checked_sub(amount_to_burn)
                .expect("Printable supply underflow");

            *print_balance = print_balance
                .checked_sub(amount_to_burn)
                .expect("Insufficient balance to burn");
        }
        (
            TokenDefinition::NonFungible {
                name: _,
                printable_supply,
                metadata_id: _,
            },
            TokenHolding::NftPrintedCopy {
                definition_id: _,
                owned,
            },
        ) => {
            assert_eq!(
                amount_to_burn, 1,
                "Invalid balance to burn for NFT Printed Copy"
            );

            assert!(*owned, "Cannot burn unowned NFT Printed Copy");

            *printable_supply = printable_supply
                .checked_sub(1)
                .expect("Printable supply underflow");

            *owned = false;
        }
        _ => panic!("Mismatched Token Definition and Token Holding types"),
    }

    let mut definition_post = definition_account.account;
    definition_post.data = Data::from(&definition);

    let mut holding_post = user_holding_account.account;
    holding_post.data = Data::from(&holding);

    vec![
        AccountPostState::new(definition_post),
        AccountPostState::new(holding_post),
    ]
}`
  },
  {
    id: 'token_initialize',
    name: 'initialize.rs',
    path: 'token/src/initialize.rs',
    label: 'Initialize a token holding account',
    program: 'token',
    content: `use nssa_core::{
    account::{Account, AccountWithMetadata, Data},
    program::AccountPostState,
};
use token_core::{TokenDefinition, TokenHolding};

pub fn initialize_account(
    definition_account: AccountWithMetadata,
    account_to_initialize: AccountWithMetadata,
) -> Vec<AccountPostState> {
    assert_eq!(
        account_to_initialize.account,
        Account::default(),
        "Only Uninitialized accounts can be initialized"
    );

    // TODO: #212 We should check that this is an account owned by the token program.
    // This check can't be done here since the ID of the program is known only after compiling it
    //
    // Check definition account is valid
    let definition = TokenDefinition::try_from(&definition_account.account.data)
        .expect("Definition account must be valid");
    let holding =
        TokenHolding::zeroized_from_definition(definition_account.account_id, &definition);

    let definition_post = definition_account.account;
    let mut account_to_initialize = account_to_initialize.account;
    account_to_initialize.data = Data::from(&holding);

    vec![
        AccountPostState::new(definition_post),
        AccountPostState::new_claimed(account_to_initialize),
    ]
}`
  },
  {
    id: 'token_mint',
    name: 'mint.rs',
    path: 'token/src/mint.rs',
    label: 'Mint new tokens',
    program: 'token',
    content: `use nssa_core::{
    account::{Account, AccountWithMetadata, Data},
    program::AccountPostState,
};
use token_core::{TokenDefinition, TokenHolding};

pub fn mint(
    definition_account: AccountWithMetadata,
    user_holding_account: AccountWithMetadata,
    amount_to_mint: u128,
) -> Vec<AccountPostState> {
    assert!(
        definition_account.is_authorized,
        "Definition authorization is missing"
    );

    let mut definition = TokenDefinition::try_from(&definition_account.account.data)
        .expect("Token Definition account must be valid");
    let mut holding = if user_holding_account.account == Account::default() {
        TokenHolding::zeroized_from_definition(definition_account.account_id, &definition)
    } else {
        TokenHolding::try_from(&user_holding_account.account.data)
            .expect("Token Holding account must be valid")
    };

    assert_eq!(
        definition_account.account_id,
        holding.definition_id(),
        "Mismatch Token Definition and Token Holding"
    );

    match (&mut definition, &mut holding) {
        (
            TokenDefinition::Fungible {
                name: _,
                metadata_id: _,
                total_supply,
            },
            TokenHolding::Fungible {
                definition_id: _,
                balance,
            },
        ) => {
            *balance = balance
                .checked_add(amount_to_mint)
                .expect("Balance overflow on minting");

            *total_supply = total_supply
                .checked_add(amount_to_mint)
                .expect("Total supply overflow");
        }
        (
            TokenDefinition::NonFungible { .. },
            TokenHolding::NftMaster { .. } | TokenHolding::NftPrintedCopy { .. },
        ) => {
            panic!("Cannot mint additional supply for Non-Fungible Tokens");
        }
        _ => panic!("Mismatched Token Definition and Token Holding types"),
    }

    let mut definition_post = definition_account.account;
    definition_post.data = Data::from(&definition);

    let mut holding_post = user_holding_account.account;
    holding_post.data = Data::from(&holding);

    vec![
        AccountPostState::new(definition_post),
        AccountPostState::new_claimed_if_default(holding_post),
    ]
}`
  },
  {
    id: 'token_new_definition',
    name: 'new_definition.rs',
    path: 'token/src/new_definition.rs',
    label: 'Create token definitions',
    program: 'token',
    content: `use nssa_core::{
    account::{Account, AccountWithMetadata, Data},
    program::AccountPostState,
};
use token_core::{
    NewTokenDefinition, NewTokenMetadata, TokenDefinition, TokenHolding, TokenMetadata,
};

pub fn new_fungible_definition(
    definition_target_account: AccountWithMetadata,
    holding_target_account: AccountWithMetadata,
    name: String,
    total_supply: u128,
) -> Vec<AccountPostState> {
    assert_eq!(
        definition_target_account.account,
        Account::default(),
        "Definition target account must have default values"
    );

    assert_eq!(
        holding_target_account.account,
        Account::default(),
        "Holding target account must have default values"
    );

    let token_definition = TokenDefinition::Fungible {
        name,
        total_supply,
        metadata_id: None,
    };
    let token_holding = TokenHolding::Fungible {
        definition_id: definition_target_account.account_id,
        balance: total_supply,
    };

    let mut definition_target_account_post = definition_target_account.account;
    definition_target_account_post.data = Data::from(&token_definition);

    let mut holding_target_account_post = holding_target_account.account;
    holding_target_account_post.data = Data::from(&token_holding);

    vec![
        AccountPostState::new_claimed(definition_target_account_post),
        AccountPostState::new_claimed(holding_target_account_post),
    ]
}

pub fn new_definition_with_metadata(
    definition_target_account: AccountWithMetadata,
    holding_target_account: AccountWithMetadata,
    metadata_target_account: AccountWithMetadata,
    new_definition: NewTokenDefinition,
    metadata: NewTokenMetadata,
) -> Vec<AccountPostState> {
    assert_eq!(
        definition_target_account.account,
        Account::default(),
        "Definition target account must have default values"
    );

    assert_eq!(
        holding_target_account.account,
        Account::default(),
        "Holding target account must have default values"
    );

    assert_eq!(
        metadata_target_account.account,
        Account::default(),
        "Metadata target account must have default values"
    );

    let (token_definition, token_holding) = match new_definition {
        NewTokenDefinition::Fungible { name, total_supply } => (
            TokenDefinition::Fungible {
                name,
                total_supply,
                metadata_id: Some(metadata_target_account.account_id),
            },
            TokenHolding::Fungible {
                definition_id: definition_target_account.account_id,
                balance: total_supply,
            },
        ),
        NewTokenDefinition::NonFungible {
            name,
            printable_supply,
        } => (
            TokenDefinition::NonFungible {
                name,
                printable_supply,
                metadata_id: metadata_target_account.account_id,
            },
            TokenHolding::NftMaster {
                definition_id: definition_target_account.account_id,
                print_balance: printable_supply,
            },
        ),
    };

    let token_metadata = TokenMetadata {
        definition_id: definition_target_account.account_id,
        standard: metadata.standard,
        uri: metadata.uri,
        creators: metadata.creators,
        primary_sale_date: 0u64, // TODO #261: future works to implement this
    };

    let mut definition_target_account_post = definition_target_account.account.clone();
    definition_target_account_post.data = Data::from(&token_definition);

    let mut holding_target_account_post = holding_target_account.account.clone();
    holding_target_account_post.data = Data::from(&token_holding);

    let mut metadata_target_account_post = metadata_target_account.account.clone();
    metadata_target_account_post.data = Data::from(&token_metadata);

    vec![
        AccountPostState::new_claimed(definition_target_account_post),
        AccountPostState::new_claimed(holding_target_account_post),
        AccountPostState::new_claimed(metadata_target_account_post),
    ]
}`
  },
  {
    id: 'token_print_nft',
    name: 'print_nft.rs',
    path: 'token/src/print_nft.rs',
    label: 'Print NFT copies',
    program: 'token',
    content: `use nssa_core::{
    account::{Account, AccountWithMetadata, Data},
    program::AccountPostState,
};
use token_core::TokenHolding;

pub fn print_nft(
    master_account: AccountWithMetadata,
    printed_account: AccountWithMetadata,
) -> Vec<AccountPostState> {
    assert!(
        master_account.is_authorized,
        "Master NFT Account must be authorized"
    );

    assert_eq!(
        printed_account.account,
        Account::default(),
        "Printed Account must be uninitialized"
    );

    let mut master_account_data =
        TokenHolding::try_from(&master_account.account.data).expect("Invalid Token Holding data");

    let TokenHolding::NftMaster {
        definition_id,
        print_balance,
    } = &mut master_account_data
    else {
        panic!("Invalid Token Holding provided as NFT Master Account");
    };

    let definition_id = *definition_id;

    assert!(
        *print_balance > 1,
        "Insufficient balance to print another NFT copy"
    );
    *print_balance -= 1;

    let mut master_account_post = master_account.account;
    master_account_post.data = Data::from(&master_account_data);

    let mut printed_account_post = printed_account.account;
    printed_account_post.data = Data::from(&TokenHolding::NftPrintedCopy {
        definition_id,
        owned: true,
    });

    vec![
        AccountPostState::new(master_account_post),
        AccountPostState::new_claimed(printed_account_post),
    ]
}`
  },
  {
    id: 'token_transfer',
    name: 'transfer.rs',
    path: 'token/src/transfer.rs',
    label: 'Transfer tokens',
    program: 'token',
    content: `use nssa_core::{
    account::{Account, AccountWithMetadata, Data},
    program::AccountPostState,
};
use token_core::TokenHolding;

pub fn transfer(
    sender: AccountWithMetadata,
    recipient: AccountWithMetadata,
    balance_to_move: u128,
) -> Vec<AccountPostState> {
    assert!(sender.is_authorized, "Sender authorization is missing");

    let mut sender_holding =
        TokenHolding::try_from(&sender.account.data).expect("Invalid sender data");

    let mut recipient_holding = if recipient.account == Account::default() {
        TokenHolding::zeroized_clone_from(&sender_holding)
    } else {
        TokenHolding::try_from(&recipient.account.data).expect("Invalid recipient data")
    };

    assert_eq!(
        sender_holding.definition_id(),
        recipient_holding.definition_id(),
        "Sender and recipient definition id mismatch"
    );

    match (&mut sender_holding, &mut recipient_holding) {
        (
            TokenHolding::Fungible {
                definition_id: _,
                balance: sender_balance,
            },
            TokenHolding::Fungible {
                definition_id: _,
                balance: recipient_balance,
            },
        ) => {
            *sender_balance = sender_balance
                .checked_sub(balance_to_move)
                .expect("Insufficient balance");

            *recipient_balance = recipient_balance
                .checked_add(balance_to_move)
                .expect("Recipient balance overflow");
        }
        (
            TokenHolding::NftMaster {
                definition_id: _,
                print_balance: sender_print_balance,
            },
            TokenHolding::NftMaster {
                definition_id: _,
                print_balance: recipient_print_balance,
            },
        ) => {
            assert_eq!(
                *recipient_print_balance, 0,
                "Invalid balance in recipient account for NFT transfer"
            );

            assert_eq!(
                *sender_print_balance, balance_to_move,
                "Invalid balance for NFT Master transfer"
            );

            std::mem::swap(sender_print_balance, recipient_print_balance);
        }
        (
            TokenHolding::NftPrintedCopy {
                definition_id: _,
                owned: sender_owned,
            },
            TokenHolding::NftPrintedCopy {
                definition_id: _,
                owned: recipient_owned,
            },
        ) => {
            assert_eq!(
                balance_to_move, 1,
                "Invalid balance for NFT Printed Copy transfer"
            );

            assert!(*sender_owned, "Sender does not own the NFT Printed Copy");

            assert!(
                !*recipient_owned,
                "Recipient already owns the NFT Printed Copy"
            );

            *sender_owned = false;
            *recipient_owned = true;
        }
        _ => {
            panic!("Mismatched token holding types for transfer");
        }
    };

    let mut sender_post = sender.account;
    sender_post.data = Data::from(&sender_holding);

    let mut recipient_post = recipient.account;
    recipient_post.data = Data::from(&recipient_holding);

    vec![
        AccountPostState::new(sender_post),
        AccountPostState::new_claimed_if_default(recipient_post),
    ]
}`
  },

  /* ---- AMM Program ---- */
  {
    id: 'amm_core_lib',
    name: 'lib.rs',
    path: 'amm/core/src/lib.rs',
    label: 'AMM core data structures',
    program: 'amm',
    content: `//! This crate contains core data structures and utilities for the AMM Program.

use borsh::{BorshDeserialize, BorshSerialize};
use nssa_core::{
    account::{AccountId, Data},
    program::{PdaSeed, ProgramId},
};
use serde::{Deserialize, Serialize};

/// AMM Program Instruction.
#[derive(Serialize, Deserialize)]
pub enum Instruction {
    /// Initializes a new Pool (or re-initializes an inactive Pool).
    ///
    /// Required accounts:
    /// - AMM Pool
    /// - Vault Holding Account for Token A
    /// - Vault Holding Account for Token B
    /// - Pool Liquidity Token Definition
    /// - User Holding Account for Token A (authorized)
    /// - User Holding Account for Token B (authorized)
    /// - User Holding Account for Pool Liquidity
    NewDefinition {
        token_a_amount: u128,
        token_b_amount: u128,
        amm_program_id: ProgramId,
    },

    /// Adds liquidity to the Pool
    ///
    /// Required accounts:
    /// - AMM Pool (initialized)
    /// - Vault Holding Account for Token A (initialized)
    /// - Vault Holding Account for Token B (initialized)
    /// - Pool Liquidity Token Definition (initialized)
    /// - User Holding Account for Token A (authorized)
    /// - User Holding Account for Token B (authorized)
    /// - User Holding Account for Pool Liquidity
    AddLiquidity {
        min_amount_liquidity: u128,
        max_amount_to_add_token_a: u128,
        max_amount_to_add_token_b: u128,
    },

    /// Removes liquidity from the Pool
    ///
    /// Required accounts:
    /// - AMM Pool (initialized)
    /// - Vault Holding Account for Token A (initialized)
    /// - Vault Holding Account for Token B (initialized)
    /// - Pool Liquidity Token Definition (initialized)
    /// - User Holding Account for Token A (initialized)
    /// - User Holding Account for Token B (initialized)
    /// - User Holding Account for Pool Liquidity (authorized)
    RemoveLiquidity {
        remove_liquidity_amount: u128,
        min_amount_to_remove_token_a: u128,
        min_amount_to_remove_token_b: u128,
    },

    /// Swap some quantity of Tokens (either Token A or Token B)
    /// while maintaining the Pool constant product.
    ///
    /// Required accounts:
    /// - AMM Pool (initialized)
    /// - Vault Holding Account for Token A (initialized)
    /// - Vault Holding Account for Token B (initialized)
    /// - User Holding Account for Token A
    /// - User Holding Account for Token B Either User Holding Account for Token A or Token B is
    ///   authorized.
    Swap {
        swap_amount_in: u128,
        min_amount_out: u128,
        token_definition_id_in: AccountId,
    },
}

#[derive(Clone, Default, Serialize, Deserialize, BorshSerialize, BorshDeserialize)]
pub struct PoolDefinition {
    pub definition_token_a_id: AccountId,
    pub definition_token_b_id: AccountId,
    pub vault_a_id: AccountId,
    pub vault_b_id: AccountId,
    pub liquidity_pool_id: AccountId,
    pub liquidity_pool_supply: u128,
    pub reserve_a: u128,
    pub reserve_b: u128,
    /// Fees are currently not used
    pub fees: u128,
    /// A pool becomes inactive (active = false)
    /// once all of its liquidity has been removed (e.g., reserves are emptied and
    /// liquidity_pool_supply = 0)
    pub active: bool,
}

impl TryFrom<&Data> for PoolDefinition {
    type Error = std::io::Error;

    fn try_from(data: &Data) -> Result<Self, Self::Error> {
        PoolDefinition::try_from_slice(data.as_ref())
    }
}

impl From<&PoolDefinition> for Data {
    fn from(definition: &PoolDefinition) -> Self {
        // Using size_of_val as size hint for Vec allocation
        let mut data = Vec::with_capacity(std::mem::size_of_val(definition));

        BorshSerialize::serialize(definition, &mut data)
            .expect("Serialization to Vec should not fail");

        Data::try_from(data).expect("Token definition encoded data should fit into Data")
    }
}

pub fn compute_pool_pda(
    amm_program_id: ProgramId,
    definition_token_a_id: AccountId,
    definition_token_b_id: AccountId,
) -> AccountId {
    AccountId::from((
        &amm_program_id,
        &compute_pool_pda_seed(definition_token_a_id, definition_token_b_id),
    ))
}

pub fn compute_pool_pda_seed(
    definition_token_a_id: AccountId,
    definition_token_b_id: AccountId,
) -> PdaSeed {
    use risc0_zkvm::sha::{Impl, Sha256};

    let (token_1, token_2) = match definition_token_a_id
        .value()
        .cmp(definition_token_b_id.value())
    {
        std::cmp::Ordering::Less => (definition_token_b_id, definition_token_a_id),
        std::cmp::Ordering::Greater => (definition_token_a_id, definition_token_b_id),
        std::cmp::Ordering::Equal => panic!("Definitions match"),
    };

    let mut bytes = [0; 64];
    bytes[0..32].copy_from_slice(&token_1.to_bytes());
    bytes[32..].copy_from_slice(&token_2.to_bytes());

    PdaSeed::new(
        Impl::hash_bytes(&bytes)
            .as_bytes()
            .try_into()
            .expect("Hash output must be exactly 32 bytes long"),
    )
}

pub fn compute_vault_pda(
    amm_program_id: ProgramId,
    pool_id: AccountId,
    definition_token_id: AccountId,
) -> AccountId {
    AccountId::from((
        &amm_program_id,
        &compute_vault_pda_seed(pool_id, definition_token_id),
    ))
}

pub fn compute_vault_pda_seed(pool_id: AccountId, definition_token_id: AccountId) -> PdaSeed {
    use risc0_zkvm::sha::{Impl, Sha256};

    let mut bytes = [0; 64];
    bytes[0..32].copy_from_slice(&pool_id.to_bytes());
    bytes[32..].copy_from_slice(&definition_token_id.to_bytes());

    PdaSeed::new(
        Impl::hash_bytes(&bytes)
            .as_bytes()
            .try_into()
            .expect("Hash output must be exactly 32 bytes long"),
    )
}

pub fn compute_liquidity_token_pda(amm_program_id: ProgramId, pool_id: AccountId) -> AccountId {
    AccountId::from((&amm_program_id, &compute_liquidity_token_pda_seed(pool_id)))
}

pub fn compute_liquidity_token_pda_seed(pool_id: AccountId) -> PdaSeed {
    use risc0_zkvm::sha::{Impl, Sha256};

    let mut bytes = [0; 64];
    bytes[0..32].copy_from_slice(&pool_id.to_bytes());
    bytes[32..].copy_from_slice(&[0; 32]);

    PdaSeed::new(
        Impl::hash_bytes(&bytes)
            .as_bytes()
            .try_into()
            .expect("Hash output must be exactly 32 bytes long"),
    )
}`
  },
  {
    id: 'amm_src_lib',
    name: 'lib.rs',
    path: 'amm/src/lib.rs',
    label: 'AMM module exports',
    program: 'amm',
    content: `//! The AMM Program implementation.

pub use amm_core as core;

pub mod add;
pub mod new_definition;
pub mod remove;
pub mod swap;

mod tests;`
  },
  {
    id: 'amm_add',
    name: 'add.rs',
    path: 'amm/src/add.rs',
    label: 'Add liquidity to pool',
    program: 'amm',
    content: `use std::num::NonZeroU128;

use amm_core::{PoolDefinition, compute_liquidity_token_pda_seed};
use nssa_core::{
    account::{AccountWithMetadata, Data},
    program::{AccountPostState, ChainedCall},
};

#[expect(clippy::too_many_arguments, reason = "TODO: Fix later")]
pub fn add_liquidity(
    pool: AccountWithMetadata,
    vault_a: AccountWithMetadata,
    vault_b: AccountWithMetadata,
    pool_definition_lp: AccountWithMetadata,
    user_holding_a: AccountWithMetadata,
    user_holding_b: AccountWithMetadata,
    user_holding_lp: AccountWithMetadata,
    min_amount_liquidity: NonZeroU128,
    max_amount_to_add_token_a: u128,
    max_amount_to_add_token_b: u128,
) -> (Vec<AccountPostState>, Vec<ChainedCall>) {
    // 1. Fetch Pool state
    let pool_def_data = PoolDefinition::try_from(&pool.account.data)
        .expect("Add liquidity: AMM Program expects valid Pool Definition Account");

    assert_eq!(
        vault_a.account_id, pool_def_data.vault_a_id,
        "Vault A was not provided"
    );

    assert_eq!(
        pool_def_data.liquidity_pool_id, pool_definition_lp.account_id,
        "LP definition mismatch"
    );

    assert_eq!(
        vault_b.account_id, pool_def_data.vault_b_id,
        "Vault B was not provided"
    );

    assert!(
        max_amount_to_add_token_a != 0 && max_amount_to_add_token_b != 0,
        "Both max-balances must be nonzero"
    );

    // 2. Determine deposit amount
    let vault_b_token_holding = token_core::TokenHolding::try_from(&vault_b.account.data)
        .expect("Add liquidity: AMM Program expects valid Token Holding Account for Vault B");
    let token_core::TokenHolding::Fungible {
        definition_id: _,
        balance: vault_b_balance,
    } = vault_b_token_holding
    else {
        panic!(
            "Add liquidity: AMM Program expects valid Fungible Token Holding Account for Vault B"
        );
    };

    let vault_a_token_holding = token_core::TokenHolding::try_from(&vault_a.account.data)
        .expect("Add liquidity: AMM Program expects valid Token Holding Account for Vault A");
    let token_core::TokenHolding::Fungible {
        definition_id: _,
        balance: vault_a_balance,
    } = vault_a_token_holding
    else {
        panic!(
            "Add liquidity: AMM Program expects valid Fungible Token Holding Account for Vault A"
        );
    };

    assert!(pool_def_data.reserve_a != 0, "Reserves must be nonzero");
    assert!(pool_def_data.reserve_b != 0, "Reserves must be nonzero");
    assert!(
        vault_a_balance >= pool_def_data.reserve_a,
        "Vaults' balances must be at least the reserve amounts"
    );
    assert!(
        vault_b_balance >= pool_def_data.reserve_b,
        "Vaults' balances must be at least the reserve amounts"
    );

    // Calculate actual_amounts
    let ideal_a: u128 =
        (pool_def_data.reserve_a * max_amount_to_add_token_b) / pool_def_data.reserve_b;
    let ideal_b: u128 =
        (pool_def_data.reserve_b * max_amount_to_add_token_a) / pool_def_data.reserve_a;

    let actual_amount_a = if ideal_a > max_amount_to_add_token_a {
        max_amount_to_add_token_a
    } else {
        ideal_a
    };
    let actual_amount_b = if ideal_b > max_amount_to_add_token_b {
        max_amount_to_add_token_b
    } else {
        ideal_b
    };

    // 3. Validate amounts
    assert!(
        max_amount_to_add_token_a >= actual_amount_a,
        "Actual trade amounts cannot exceed max_amounts"
    );
    assert!(
        max_amount_to_add_token_b >= actual_amount_b,
        "Actual trade amounts cannot exceed max_amounts"
    );

    assert!(actual_amount_a != 0, "A trade amount is 0");
    assert!(actual_amount_b != 0, "A trade amount is 0");

    // 4. Calculate LP to mint
    let delta_lp = std::cmp::min(
        pool_def_data.liquidity_pool_supply * actual_amount_a / pool_def_data.reserve_a,
        pool_def_data.liquidity_pool_supply * actual_amount_b / pool_def_data.reserve_b,
    );

    assert!(delta_lp != 0, "Payable LP must be nonzero");

    assert!(
        delta_lp >= min_amount_liquidity.get(),
        "Payable LP is less than provided minimum LP amount"
    );

    // 5. Update pool account
    let mut pool_post = pool.account.clone();
    let pool_post_definition = PoolDefinition {
        liquidity_pool_supply: pool_def_data.liquidity_pool_supply + delta_lp,
        reserve_a: pool_def_data.reserve_a + actual_amount_a,
        reserve_b: pool_def_data.reserve_b + actual_amount_b,
        ..pool_def_data
    };

    pool_post.data = Data::from(&pool_post_definition);
    let token_program_id = user_holding_a.account.program_owner;

    // Chain call for Token A (UserHoldingA -> Vault_A)
    let call_token_a = ChainedCall::new(
        token_program_id,
        vec![user_holding_a.clone(), vault_a.clone()],
        &token_core::Instruction::Transfer {
            amount_to_transfer: actual_amount_a,
        },
    );
    // Chain call for Token B (UserHoldingB -> Vault_B)
    let call_token_b = ChainedCall::new(
        token_program_id,
        vec![user_holding_b.clone(), vault_b.clone()],
        &token_core::Instruction::Transfer {
            amount_to_transfer: actual_amount_b,
        },
    );
    // Chain call for LP (mint new tokens for user_holding_lp)
    let mut pool_definition_lp_auth = pool_definition_lp.clone();
    pool_definition_lp_auth.is_authorized = true;
    let call_token_lp = ChainedCall::new(
        token_program_id,
        vec![pool_definition_lp_auth.clone(), user_holding_lp.clone()],
        &token_core::Instruction::Mint {
            amount_to_mint: delta_lp,
        },
    )
    .with_pda_seeds(vec![compute_liquidity_token_pda_seed(pool.account_id)]);

    let chained_calls = vec![call_token_lp, call_token_b, call_token_a];

    let post_states = vec![
        AccountPostState::new(pool_post),
        AccountPostState::new(vault_a.account.clone()),
        AccountPostState::new(vault_b.account.clone()),
        AccountPostState::new(pool_definition_lp.account.clone()),
        AccountPostState::new(user_holding_a.account.clone()),
        AccountPostState::new(user_holding_b.account.clone()),
        AccountPostState::new(user_holding_lp.account.clone()),
    ];

    (post_states, chained_calls)
}`
  },
  {
    id: 'amm_new_definition',
    name: 'new_definition.rs',
    path: 'amm/src/new_definition.rs',
    label: 'Create a new liquidity pool',
    program: 'amm',
    content: `use std::num::NonZeroU128;

use amm_core::{
    PoolDefinition, compute_liquidity_token_pda, compute_liquidity_token_pda_seed,
    compute_pool_pda, compute_vault_pda,
};
use nssa_core::{
    account::{Account, AccountWithMetadata, Data},
    program::{AccountPostState, ChainedCall, ProgramId},
};

#[expect(clippy::too_many_arguments, reason = "TODO: Fix later")]
pub fn new_definition(
    pool: AccountWithMetadata,
    vault_a: AccountWithMetadata,
    vault_b: AccountWithMetadata,
    pool_definition_lp: AccountWithMetadata,
    user_holding_a: AccountWithMetadata,
    user_holding_b: AccountWithMetadata,
    user_holding_lp: AccountWithMetadata,
    token_a_amount: NonZeroU128,
    token_b_amount: NonZeroU128,
    amm_program_id: ProgramId,
) -> (Vec<AccountPostState>, Vec<ChainedCall>) {
    // Verify token_a and token_b are different
    let definition_token_a_id = token_core::TokenHolding::try_from(&user_holding_a.account.data)
        .expect("New definition: AMM Program expects valid Token Holding account for Token A")
        .definition_id();
    let definition_token_b_id = token_core::TokenHolding::try_from(&user_holding_b.account.data)
        .expect("New definition: AMM Program expects valid Token Holding account for Token B")
        .definition_id();

    // both instances of the same token program
    let token_program = user_holding_a.account.program_owner;

    assert_eq!(
        user_holding_b.account.program_owner, token_program,
        "User Token holdings must use the same Token Program"
    );
    assert!(
        definition_token_a_id != definition_token_b_id,
        "Cannot set up a swap for a token with itself"
    );
    assert_eq!(
        pool.account_id,
        compute_pool_pda(amm_program_id, definition_token_a_id, definition_token_b_id),
        "Pool Definition Account ID does not match PDA"
    );
    assert_eq!(
        vault_a.account_id,
        compute_vault_pda(amm_program_id, pool.account_id, definition_token_a_id),
        "Vault ID does not match PDA"
    );
    assert_eq!(
        vault_b.account_id,
        compute_vault_pda(amm_program_id, pool.account_id, definition_token_b_id),
        "Vault ID does not match PDA"
    );
    assert_eq!(
        pool_definition_lp.account_id,
        compute_liquidity_token_pda(amm_program_id, pool.account_id),
        "Liquidity pool Token Definition Account ID does not match PDA"
    );

    // TODO: return here
    // Verify that Pool Account is not active
    let pool_account_data = if pool.account == Account::default() {
        PoolDefinition::default()
    } else {
        PoolDefinition::try_from(&pool.account.data)
            .expect("AMM program expects a valid Pool account")
    };

    assert!(
        !pool_account_data.active,
        "Cannot initialize an active Pool Definition"
    );

    // LP Token minting calculation
    let initial_lp = (token_a_amount.get() * token_b_amount.get()).isqrt();

    // Update pool account
    let mut pool_post = pool.account.clone();
    let pool_post_definition = PoolDefinition {
        definition_token_a_id,
        definition_token_b_id,
        vault_a_id: vault_a.account_id,
        vault_b_id: vault_b.account_id,
        liquidity_pool_id: pool_definition_lp.account_id,
        liquidity_pool_supply: initial_lp,
        reserve_a: token_a_amount.into(),
        reserve_b: token_b_amount.into(),
        fees: 0u128, // TODO: we assume all fees are 0 for now.
        active: true,
    };

    pool_post.data = Data::from(&pool_post_definition);
    let pool_post: AccountPostState = if pool.account == Account::default() {
        AccountPostState::new_claimed(pool_post.clone())
    } else {
        AccountPostState::new(pool_post.clone())
    };

    let token_program_id = user_holding_a.account.program_owner;

    // Chain call for Token A (user_holding_a -> Vault_A)
    let call_token_a = ChainedCall::new(
        token_program_id,
        vec![user_holding_a.clone(), vault_a.clone()],
        &token_core::Instruction::Transfer {
            amount_to_transfer: token_a_amount.into(),
        },
    );
    // Chain call for Token B (user_holding_b -> Vault_B)
    let call_token_b = ChainedCall::new(
        token_program_id,
        vec![user_holding_b.clone(), vault_b.clone()],
        &token_core::Instruction::Transfer {
            amount_to_transfer: token_b_amount.into(),
        },
    );

    // Chain call for liquidity token (TokenLP definition -> User LP Holding)
    let instruction = if pool.account == Account::default() {
        token_core::Instruction::NewFungibleDefinition {
            name: String::from("LP Token"),
            total_supply: initial_lp,
        }
    } else {
        token_core::Instruction::Mint {
            amount_to_mint: initial_lp,
        }
    };

    let mut pool_lp_auth = pool_definition_lp.clone();
    pool_lp_auth.is_authorized = true;

    let call_token_lp = ChainedCall::new(
        token_program_id,
        vec![pool_lp_auth.clone(), user_holding_lp.clone()],
        &instruction,
    )
    .with_pda_seeds(vec![compute_liquidity_token_pda_seed(pool.account_id)]);

    let chained_calls = vec![call_token_lp, call_token_b, call_token_a];

    let post_states = vec![
        pool_post.clone(),
        AccountPostState::new(vault_a.account.clone()),
        AccountPostState::new(vault_b.account.clone()),
        AccountPostState::new(pool_definition_lp.account.clone()),
        AccountPostState::new(user_holding_a.account.clone()),
        AccountPostState::new(user_holding_b.account.clone()),
        AccountPostState::new(user_holding_lp.account.clone()),
    ];

    (post_states.clone(), chained_calls)
}`
  },
  {
    id: 'amm_remove',
    name: 'remove.rs',
    path: 'amm/src/remove.rs',
    label: 'Remove liquidity from pool',
    program: 'amm',
    content: `use std::num::NonZeroU128;

use amm_core::{PoolDefinition, compute_liquidity_token_pda_seed, compute_vault_pda_seed};
use nssa_core::{
    account::{AccountWithMetadata, Data},
    program::{AccountPostState, ChainedCall},
};

#[expect(clippy::too_many_arguments, reason = "TODO: Fix later")]
pub fn remove_liquidity(
    pool: AccountWithMetadata,
    vault_a: AccountWithMetadata,
    vault_b: AccountWithMetadata,
    pool_definition_lp: AccountWithMetadata,
    user_holding_a: AccountWithMetadata,
    user_holding_b: AccountWithMetadata,
    user_holding_lp: AccountWithMetadata,
    remove_liquidity_amount: NonZeroU128,
    min_amount_to_remove_token_a: u128,
    min_amount_to_remove_token_b: u128,
) -> (Vec<AccountPostState>, Vec<ChainedCall>) {
    let remove_liquidity_amount: u128 = remove_liquidity_amount.into();

    // 1. Fetch Pool state
    let pool_def_data = PoolDefinition::try_from(&pool.account.data)
        .expect("Remove liquidity: AMM Program expects a valid Pool Definition Account");

    assert!(pool_def_data.active, "Pool is inactive");
    assert_eq!(
        pool_def_data.liquidity_pool_id, pool_definition_lp.account_id,
        "LP definition mismatch"
    );
    assert_eq!(
        vault_a.account_id, pool_def_data.vault_a_id,
        "Vault A was not provided"
    );
    assert_eq!(
        vault_b.account_id, pool_def_data.vault_b_id,
        "Vault B was not provided"
    );

    // Vault addresses do not need to be checked with PDA
    // calculation for setting authorization since stored
    // in the Pool Definition.
    let mut running_vault_a = vault_a.clone();
    let mut running_vault_b = vault_b.clone();
    running_vault_a.is_authorized = true;
    running_vault_b.is_authorized = true;

    assert!(
        min_amount_to_remove_token_a != 0,
        "Minimum withdraw amount must be nonzero"
    );
    assert!(
        min_amount_to_remove_token_b != 0,
        "Minimum withdraw amount must be nonzero"
    );

    // 2. Compute withdrawal amounts
    let user_holding_lp_data = token_core::TokenHolding::try_from(&user_holding_lp.account.data)
        .expect("Remove liquidity: AMM Program expects a valid Token Account for liquidity token");
    let token_core::TokenHolding::Fungible {
        definition_id: _,
        balance: user_lp_balance,
    } = user_holding_lp_data
    else {
        panic!(
            "Remove liquidity: AMM Program expects a valid Fungible Token Holding Account for liquidity token"
        );
    };

    assert!(
        user_lp_balance <= pool_def_data.liquidity_pool_supply,
        "Invalid liquidity account provided"
    );
    assert_eq!(
        user_holding_lp_data.definition_id(),
        pool_def_data.liquidity_pool_id,
        "Invalid liquidity account provided"
    );

    let withdraw_amount_a =
        (pool_def_data.reserve_a * remove_liquidity_amount) / pool_def_data.liquidity_pool_supply;
    let withdraw_amount_b =
        (pool_def_data.reserve_b * remove_liquidity_amount) / pool_def_data.liquidity_pool_supply;

    // 3. Validate and slippage check
    assert!(
        withdraw_amount_a >= min_amount_to_remove_token_a,
        "Insufficient minimal withdraw amount (Token A) provided for liquidity amount"
    );
    assert!(
        withdraw_amount_b >= min_amount_to_remove_token_b,
        "Insufficient minimal withdraw amount (Token B) provided for liquidity amount"
    );

    // 4. Calculate LP to reduce cap by
    let delta_lp: u128 = (pool_def_data.liquidity_pool_supply * remove_liquidity_amount)
        / pool_def_data.liquidity_pool_supply;

    let active: bool = pool_def_data.liquidity_pool_supply - delta_lp != 0;

    // 5. Update pool account
    let mut pool_post = pool.account.clone();
    let pool_post_definition = PoolDefinition {
        liquidity_pool_supply: pool_def_data.liquidity_pool_supply - delta_lp,
        reserve_a: pool_def_data.reserve_a - withdraw_amount_a,
        reserve_b: pool_def_data.reserve_b - withdraw_amount_b,
        active,
        ..pool_def_data.clone()
    };

    pool_post.data = Data::from(&pool_post_definition);

    let token_program_id = user_holding_a.account.program_owner;

    // Chaincall for Token A withdraw
    let call_token_a = ChainedCall::new(
        token_program_id,
        vec![running_vault_a, user_holding_a.clone()],
        &token_core::Instruction::Transfer {
            amount_to_transfer: withdraw_amount_a,
        },
    )
    .with_pda_seeds(vec![compute_vault_pda_seed(
        pool.account_id,
        pool_def_data.definition_token_a_id,
    )]);
    // Chaincall for Token B withdraw
    let call_token_b = ChainedCall::new(
        token_program_id,
        vec![running_vault_b, user_holding_b.clone()],
        &token_core::Instruction::Transfer {
            amount_to_transfer: withdraw_amount_b,
        },
    )
    .with_pda_seeds(vec![compute_vault_pda_seed(
        pool.account_id,
        pool_def_data.definition_token_b_id,
    )]);
    // Chaincall for LP adjustment
    let mut pool_definition_lp_auth = pool_definition_lp.clone();
    pool_definition_lp_auth.is_authorized = true;
    let call_token_lp = ChainedCall::new(
        token_program_id,
        vec![pool_definition_lp_auth, user_holding_lp.clone()],
        &token_core::Instruction::Burn {
            amount_to_burn: delta_lp,
        },
    )
    .with_pda_seeds(vec![compute_liquidity_token_pda_seed(pool.account_id)]);

    let chained_calls = vec![call_token_lp, call_token_b, call_token_a];

    let post_states = vec![
        AccountPostState::new(pool_post.clone()),
        AccountPostState::new(vault_a.account.clone()),
        AccountPostState::new(vault_b.account.clone()),
        AccountPostState::new(pool_definition_lp.account.clone()),
        AccountPostState::new(user_holding_a.account.clone()),
        AccountPostState::new(user_holding_b.account.clone()),
        AccountPostState::new(user_holding_lp.account.clone()),
    ];

    (post_states, chained_calls)
}`
  },
  {
    id: 'amm_swap',
    name: 'swap.rs',
    path: 'amm/src/swap.rs',
    label: 'Swap tokens',
    program: 'amm',
    content: `pub use amm_core::{PoolDefinition, compute_liquidity_token_pda_seed, compute_vault_pda_seed};
use nssa_core::{
    account::{AccountId, AccountWithMetadata, Data},
    program::{AccountPostState, ChainedCall},
};

#[expect(clippy::too_many_arguments, reason = "TODO: Fix later")]
pub fn swap(
    pool: AccountWithMetadata,
    vault_a: AccountWithMetadata,
    vault_b: AccountWithMetadata,
    user_holding_a: AccountWithMetadata,
    user_holding_b: AccountWithMetadata,
    swap_amount_in: u128,
    min_amount_out: u128,
    token_in_id: AccountId,
) -> (Vec<AccountPostState>, Vec<ChainedCall>) {
    // Verify vaults are in fact vaults
    let pool_def_data = PoolDefinition::try_from(&pool.account.data)
        .expect("Swap: AMM Program expects a valid Pool Definition Account");

    assert!(pool_def_data.active, "Pool is inactive");
    assert_eq!(
        vault_a.account_id, pool_def_data.vault_a_id,
        "Vault A was not provided"
    );
    assert_eq!(
        vault_b.account_id, pool_def_data.vault_b_id,
        "Vault B was not provided"
    );

    // fetch pool reserves
    // validates reserves is at least the vaults' balances
    let vault_a_token_holding = token_core::TokenHolding::try_from(&vault_a.account.data)
        .expect("Swap: AMM Program expects a valid Token Holding Account for Vault A");
    let token_core::TokenHolding::Fungible {
        definition_id: _,
        balance: vault_a_balance,
    } = vault_a_token_holding
    else {
        panic!("Swap: AMM Program expects a valid Fungible Token Holding Account for Vault A");
    };

    assert!(
        vault_a_balance >= pool_def_data.reserve_a,
        "Reserve for Token A exceeds vault balance"
    );

    let vault_b_token_holding = token_core::TokenHolding::try_from(&vault_b.account.data)
        .expect("Swap: AMM Program expects a valid Token Holding Account for Vault B");
    let token_core::TokenHolding::Fungible {
        definition_id: _,
        balance: vault_b_balance,
    } = vault_b_token_holding
    else {
        panic!("Swap: AMM Program expects a valid Fungible Token Holding Account for Vault B");
    };

    assert!(
        vault_b_balance >= pool_def_data.reserve_b,
        "Reserve for Token B exceeds vault balance"
    );

    let (chained_calls, [deposit_a, withdraw_a], [deposit_b, withdraw_b]) =
        if token_in_id == pool_def_data.definition_token_a_id {
            let (chained_calls, deposit_a, withdraw_b) = swap_logic(
                user_holding_a.clone(),
                vault_a.clone(),
                vault_b.clone(),
                user_holding_b.clone(),
                swap_amount_in,
                min_amount_out,
                pool_def_data.reserve_a,
                pool_def_data.reserve_b,
                pool.account_id,
            );

            (chained_calls, [deposit_a, 0], [0, withdraw_b])
        } else if token_in_id == pool_def_data.definition_token_b_id {
            let (chained_calls, deposit_b, withdraw_a) = swap_logic(
                user_holding_b.clone(),
                vault_b.clone(),
                vault_a.clone(),
                user_holding_a.clone(),
                swap_amount_in,
                min_amount_out,
                pool_def_data.reserve_b,
                pool_def_data.reserve_a,
                pool.account_id,
            );

            (chained_calls, [0, withdraw_a], [deposit_b, 0])
        } else {
            panic!("AccountId is not a token type for the pool");
        };

    // Update pool account
    let mut pool_post = pool.account.clone();
    let pool_post_definition = PoolDefinition {
        reserve_a: pool_def_data.reserve_a + deposit_a - withdraw_a,
        reserve_b: pool_def_data.reserve_b + deposit_b - withdraw_b,
        ..pool_def_data
    };

    pool_post.data = Data::from(&pool_post_definition);

    let post_states = vec![
        AccountPostState::new(pool_post.clone()),
        AccountPostState::new(vault_a.account.clone()),
        AccountPostState::new(vault_b.account.clone()),
        AccountPostState::new(user_holding_a.account.clone()),
        AccountPostState::new(user_holding_b.account.clone()),
    ];

    (post_states, chained_calls)
}

#[expect(clippy::too_many_arguments, reason = "TODO: Fix later")]
fn swap_logic(
    user_deposit: AccountWithMetadata,
    vault_deposit: AccountWithMetadata,
    vault_withdraw: AccountWithMetadata,
    user_withdraw: AccountWithMetadata,
    swap_amount_in: u128,
    min_amount_out: u128,
    reserve_deposit_vault_amount: u128,
    reserve_withdraw_vault_amount: u128,
    pool_id: AccountId,
) -> (Vec<ChainedCall>, u128, u128) {
    // Compute withdraw amount
    // Maintains pool constant product
    // k = pool_def_data.reserve_a * pool_def_data.reserve_b;
    let withdraw_amount = (reserve_withdraw_vault_amount * swap_amount_in)
        / (reserve_deposit_vault_amount + swap_amount_in);

    // Slippage check
    assert!(
        min_amount_out <= withdraw_amount,
        "Withdraw amount is less than minimal amount out"
    );
    assert!(withdraw_amount != 0, "Withdraw amount should be nonzero");

    let token_program_id = user_deposit.account.program_owner;

    let mut chained_calls = Vec::new();
    chained_calls.push(ChainedCall::new(
        token_program_id,
        vec![user_deposit, vault_deposit],
        &token_core::Instruction::Transfer {
            amount_to_transfer: swap_amount_in,
        },
    ));

    let mut vault_withdraw = vault_withdraw.clone();
    vault_withdraw.is_authorized = true;

    let pda_seed = compute_vault_pda_seed(
        pool_id,
        token_core::TokenHolding::try_from(&vault_withdraw.account.data)
            .expect("Swap Logic: AMM Program expects valid token data")
            .definition_id(),
    );

    chained_calls.push(
        ChainedCall::new(
            token_program_id,
            vec![vault_withdraw, user_withdraw],
            &token_core::Instruction::Transfer {
                amount_to_transfer: withdraw_amount,
            },
        )
        .with_pda_seeds(vec![pda_seed]),
    );

    (chained_calls, swap_amount_in, withdraw_amount)
}`
  },
];

/* ---- Per-line explanations ---- */
const EXPLANATIONS = {

/* ============================================================
   token/core/src/lib.rs
   ============================================================ */
'token_core_lib': {
  1: { title: 'Module-level documentation comment',
    body: `<p>The <code>//!</code> prefix is a <strong>module-level doc comment</strong>. The <code>!</code> means "document the thing I am <em>inside</em>". In Python this is your module docstring:</p><div class="py"><code>"""This module contains core data structures for the Token Program."""</code></div><p>Running <code>cargo doc</code> compiles all <code>///</code> and <code>//!</code> comments into HTML documentation — the Rust equivalent of Sphinx or pdoc.</p>`},
  3: { title: 'Import: Borsh binary serialization',
    body: `<p>This is Python's <code>from borsh import BorshDeserialize, BorshSerialize</code>. The curly-brace syntax <code>borsh::{A, B}</code> imports multiple items from one module — like Python's <code>from x import A, B</code>.</p><div class="chain">On a blockchain, account data is stored as raw bytes. Borsh converts your structs/enums to/from compact binary. It's like Python's <code>pickle</code> or <code>struct.pack</code>, but deterministic — identical data always produces identical bytes, which is essential for ZK proofs.</div>`},
  4: { title: 'Import: blockchain account types',
    body: `<p>Imports from the LEZ framework's <code>nssa_core</code> crate:</p><ul style="margin:6px 0 6px 20px"><li><code>AccountId</code> — a 32-byte unique address for an account (like a UUID or wallet address)</li><li><code>Data</code> — raw bytes stored inside an account (like a database BLOB field)</li></ul><p>In Python: <code>from nssa_core.account import AccountId, Data</code></p>`},
  5: { title: 'Import: Serde serialization (JSON-compatible)',
    body: `<p>Serde is Rust's universal serialization library — like Python's <code>json</code> module combined with <code>dataclasses</code>. It supports JSON, YAML, MessagePack, and more. Here it allows the <code>Instruction</code> enum to be serialized to JSON so transactions can be encoded.</p><div class="py"><code>from dataclasses import dataclass, asdict<br>import json</code></div>`},
  7: { title: 'Doc comment: Token Program Instruction',
    body: `<p>Lines starting with <code>///</code> (triple slash) are <strong>item doc comments</strong>. They attach to the <em>next</em> declaration. In Python, this is a docstring on the class below.</p><p>These are compiled into HTML API docs by <code>cargo doc</code>.</p>`},
  8: { title: '#[derive(…)] — auto-generate trait implementations',
    body: `<p><code>#[derive(...)]</code> is an <strong>attribute macro</strong> — it instructs the compiler to automatically implement traits for the type below. Think of it like Python's <code>@dataclass</code> decorator, but more powerful.</p><div class="py"><code>@dataclass  # auto-generates __init__, __repr__, __eq__<br>class Instruction: ...</code></div><p>Here it derives <code>Serialize</code> and <code>Deserialize</code> from Serde, meaning the <code>Instruction</code> enum automatically gains <code>to_json()</code>-like and <code>from_json()</code>-like behavior without writing any conversion code by hand.</p>`},
  9: { title: 'pub enum Instruction — the Token Program\'s API',
    body: `<p>This is the most important definition in this file. <code>enum Instruction</code> lists <strong>every operation</strong> the Token program supports. In Python, think of it as the complete list of methods on a service class:</p><div class="py"><code>class TokenProgram:<br>    def transfer(self, amount): ...<br>    def mint(self, amount): ...<br>    def burn(self, amount): ...<br>    # etc.</code></div><div class="chain">When a user wants to mint tokens, they create a transaction containing a serialized <code>Instruction::Mint { amount_to_mint: 100 }</code> value. The blockchain runtime deserializes it and routes it to the correct handler. The <code>enum</code> is the contract between callers and the program.</div><p><code>pub</code> makes this visible to other crates — like Python's lack of a leading underscore.</p>`},
  15: { title: 'Transfer variant — move tokens between accounts',
    body: `<p><code>Transfer { amount_to_transfer: u128 }</code> is an <strong>enum variant with named fields</strong>. In Python 3.10+ structural pattern matching terms:</p><div class="py"><code>case Transfer(amount_to_transfer=n): ...</code></div><p><code>u128</code> is an unsigned 128-bit integer — in Python, just an <code>int</code> (Python ints are arbitrary precision; Rust pins the size for memory safety and ZK performance). A 128-bit integer can hold values up to ~3.4 × 10³⁸, more than enough for token balances.</p>`},
  22: { title: 'NewFungibleDefinition — create a new token type',
    body: `<p>This variant creates a brand new fungible token (like USDC or a game currency). It carries two pieces of data: the token's <code>name</code> (a <code>String</code>) and <code>total_supply</code> (how many tokens exist at creation).</p><div class="chain">On LEZ, a "token definition" is a separate on-chain account that stores the metadata about a token type — its name, supply, etc. A "token holding" account is a separate account for each user that holds a balance of that token. This is similar to how ERC-20 tokens work on Ethereum.</div>`},
  30: { title: 'NewDefinitionWithMetadata — create token with metadata',
    body: `<p>Like <code>NewFungibleDefinition</code> but also creates a metadata account (storing a URI pointing to off-chain JSON, plus creator info). Works for both fungible tokens and NFTs.</p><p><code>Box&lt;NewTokenMetadata&gt;</code> puts the metadata on the heap rather than the stack. In Python everything is heap-allocated, so this is invisible to you — but in Rust, large enum variants can cause the whole enum to be large. <code>Box</code> makes it a pointer (8 bytes) instead of an inline value.</p>`},
  41: { title: 'InitializeAccount — create an empty holding account',
    body: `<p>This variant has no fields — it's like a unit/singleton enum member. It initializes a blank token-holding account for a given token definition (setting balance to zero). You'd call this before transferring tokens to a new address that has never held that token.</p><div class="chain">In Ethereum, token balances default to 0. In LEZ's account model, you must explicitly create the holding account first. This is similar to how Solana requires you to create Associated Token Accounts (ATAs) before receiving tokens.</div>`},
  48: { title: 'Burn — permanently destroy tokens',
    body: `<p>Destroys <code>amount_to_burn</code> tokens from the holder's account, reducing both the holder's balance and the token's total supply. Authorization is required — you can only burn tokens you own.</p>`},
  55: { title: 'Mint — create new tokens',
    body: `<p>Creates <code>amount_to_mint</code> new tokens and adds them to a holding account, increasing the total supply. Only the token definition's owner (authorized account) can mint. NFTs cannot be minted this way — use <code>PrintNft</code> instead.</p>`},
  62: { title: 'PrintNft — create a copy of an NFT',
    body: `<p>Creates a new <code>NftPrintedCopy</code> from an <code>NftMaster</code>. The master account tracks how many copies remain printable. This is like a limited-edition print run — the master holds the printing rights, and each print reduces the remaining allowance.</p>`},
  65: { title: '#[derive(Serialize, Deserialize)] on NewTokenDefinition',
    body: `<p>Same derive as <code>Instruction</code>: auto-generates JSON serialization. This is an <strong>input-only</strong> type used when creating tokens — it carries the constructor parameters before any on-chain state exists.</p>`},
  66: { title: 'NewTokenDefinition enum — input type for creating tokens',
    body: `<p>A helper enum used as a parameter when creating a new token definition with metadata. It lets you specify whether you're creating a <strong>Fungible</strong> token (like a currency — divisible, interchangeable) or a <strong>NonFungible</strong> token (an NFT — unique, one-of-a-kind).</p><div class="py"><code>class NewTokenDefinition:<br>    pass<br><br>@dataclass<br>class Fungible(NewTokenDefinition):<br>    name: str<br>    total_supply: int<br><br>@dataclass<br>class NonFungible(NewTokenDefinition):<br>    name: str<br>    printable_supply: int</code></div>`},
  77: { title: '#[derive(Debug, PartialEq, Eq, …)] on TokenDefinition',
    body: `<p>Multiple traits derived at once:</p><ul style="margin:6px 0 6px 20px"><li><code>Debug</code> — enables <code>{:?}</code> formatting, like Python's <code>__repr__</code></li><li><code>PartialEq, Eq</code> — enables <code>==</code> comparisons, like Python's <code>__eq__</code></li><li><code>Serialize, Deserialize</code> — JSON serialization (Serde)</li><li><code>BorshSerialize, BorshDeserialize</code> — binary serialization for on-chain storage</li></ul><p>Having both Serde and Borsh lets this type be used in both transaction payloads (JSON) and on-chain storage (binary).</p>`},
  78: { title: 'TokenDefinition — on-chain token type record',
    body: `<p>This is the <strong>definition</strong> (metadata) of a token type — stored as an on-chain account. Think of it like a database record describing a token class:</p><div class="py"><code>@dataclass<br>class TokenDefinition:<br>    pass  # abstract base<br><br>@dataclass<br>class FungibleToken(TokenDefinition):<br>    name: str<br>    total_supply: int<br>    metadata_id: Optional[AccountId] = None<br><br>@dataclass<br>class NonFungibleToken(TokenDefinition):<br>    name: str<br>    printable_supply: int<br>    metadata_id: AccountId  # required for NFTs</code></div><div class="chain">Every token on LEZ has a definition account (like a class) and one or more holding accounts (like instances, one per user). The definition tracks global state (total supply); holdings track individual balances.</div>`},
  91: { title: 'impl TryFrom<&Data> for TokenDefinition — deserialization',
    body: `<p><code>impl TryFrom&lt;A&gt; for B</code> means "implement a conversion from A to B that can fail". In Python, this is a classmethod that can raise an exception:</p><div class="py"><code>@classmethod<br>def from_data(cls, data: bytes) -> 'TokenDefinition':<br>    # may raise an error<br>    return cls._deserialize(data)</code></div><p><code>TryFrom</code> is a standard Rust trait. Implementing it means you can write <code>TokenDefinition::try_from(&data)</code> to convert raw bytes to a <code>TokenDefinition</code>. The <code>type Error = std::io::Error</code> line declares what kind of error can be returned on failure.</p>`},
  95: { title: 'try_from_slice — Borsh deserialization',
    body: `<p>Borsh's deserialization method — reads bytes and reconstructs the struct. In Python: <code>pickle.loads(data)</code> or <code>msgpack.unpackb(data)</code>.</p><p><code>data.as_ref()</code> converts the <code>Data</code> type to a plain byte slice (<code>&[u8]</code>). In Python, this would be calling <code>bytes(data)</code> to get a raw bytes object.</p>`},
  99: { title: 'impl From<&TokenDefinition> for Data — serialization',
    body: `<p>The reverse conversion: turn a <code>TokenDefinition</code> into raw bytes for storage. <code>From</code> (as opposed to <code>TryFrom</code>) cannot fail — this is guaranteed to succeed.</p><div class="py"><code>def to_data(definition: TokenDefinition) -> bytes:<br>    return borsh.serialize(definition)</code></div>`},
  107: { title: 'Vec::with_capacity — pre-sized list allocation',
    body: `<p><code>Vec::with_capacity(n)</code> creates a new empty list pre-allocating space for <code>n</code> elements. In Python, this is just <code>[]</code> (Python handles allocation automatically). In Rust, this is an optimization — we're giving the allocator a hint about how much memory to reserve, avoiding repeated reallocations.</p><p><code>std::mem::size_of_val(definition)</code> returns the in-memory size of the value in bytes — a rough lower bound for the serialized size.</p>`},
  111: { title: 'TokenHolding — a user\'s token balance account',
    body: `<p>This enum represents a single account holding a specific token. There are three variants depending on token type:</p><ul style="margin:6px 0 6px 20px"><li><code>Fungible</code> — holds a numeric balance of a fungible token (like 100 USDC)</li><li><code>NftMaster</code> — holds an NFT with a "print allowance" (can spawn copies)</li><li><code>NftPrintedCopy</code> — holds an NFT printed copy (either owned or not)</li></ul><div class="chain">In an account-based blockchain like LEZ, every (user, token) pair needs a separate holding account. User Alice has one holding account for Token A and another for Token B. This is similar to how Solana SPL tokens work.</div>`},
  130: { title: 'zeroized_clone_from — create empty holding of same type',
    body: `<p>A <code>pub</code> static-like method (not quite — in Rust it's an "associated function") that creates a zeroed-out copy of a holding account, preserving the token type and definition_id but resetting the balance to zero.</p><div class="py"><code>@classmethod<br>def zeroized_clone_from(cls, other: 'TokenHolding') -> 'TokenHolding':<br>    if isinstance(other, Fungible):<br>        return Fungible(definition_id=other.definition_id, balance=0)</code></div><p>This is used when transferring tokens to a <em>new</em> recipient who doesn't yet have a holding account for this token.</p>`},
  131: { title: 'match — Rust\'s pattern matching (like Python\'s match/case)',
    body: `<p><code>match</code> in Rust is like Python 3.10's <code>match</code>/<code>case</code>, but mandatory — the compiler enforces that every possible variant is handled. Forgetting a case is a compile error.</p><div class="py"><code>match other:<br>    case TokenHolding.Fungible(definition_id=d, ...):<br>        return TokenHolding.Fungible(definition_id=d, balance=0)</code></div><p>The <code>..</code> in <code>Fungible { definition_id, .. }</code> means "ignore all other fields" — like <code>**_</code> in Python destructuring.</p>`},
  147: { title: 'zeroized_from_definition — create holding from a definition',
    body: `<p>Creates a zeroed holding account from a token <em>definition</em> (the type spec) rather than from an existing holding. Used during <code>InitializeAccount</code> to create a fresh account.</p><p>For a <code>Fungible</code> definition → creates <code>TokenHolding::Fungible { balance: 0 }</code>. For a <code>NonFungible</code> definition → creates <code>TokenHolding::NftPrintedCopy { owned: false }</code>.</p>`},
  163: { title: 'definition_id() — getter method for definition ID',
    body: `<p>A method that returns the <code>definition_id</code> from any variant of <code>TokenHolding</code>, regardless of which variant it is. In Python, you'd use <code>@property</code>:</p><div class="py"><code>@property<br>def definition_id(self) -> AccountId:<br>    match self:<br>        case Fungible(definition_id=d): return d<br>        case NftMaster(definition_id=d): return d<br>        case NftPrintedCopy(definition_id=d): return d</code></div><p><code>&amp;self</code> means "read-only reference to self" — like Python's <code>self</code> in a regular method, but Rust makes the immutability explicit.</p>`},
  192: { title: 'NewTokenMetadata — input struct for metadata creation',
    body: `<p>A plain struct (like a Python dataclass) carrying the metadata parameters when creating a new token with metadata. Notice there are no <code>BorshSerialize/BorshDeserialize</code> derives — this is a transient input type, not stored on-chain.</p><div class="py"><code>@dataclass<br>class NewTokenMetadata:<br>    standard: MetadataStandard<br>    uri: str  # off-chain JSON URL<br>    creators: str</code></div>`},
  203: { title: 'TokenMetadata — on-chain metadata storage struct',
    body: `<p>The metadata stored on-chain once a token is created. Unlike <code>NewTokenMetadata</code>, this has <code>BorshSerialize/BorshDeserialize</code> (for on-chain storage) and includes the <code>definition_id</code> and <code>primary_sale_date</code>.</p><div class="chain">The <code>uri</code> field points to off-chain JSON (like an IPFS URL) describing the token in detail — image, description, attributes. Storing full metadata on-chain is expensive; this is the standard pattern.</div>`},
  216: { title: 'MetadataStandard — enum for off-chain metadata format',
    body: `<p>A simple two-variant enum (like a Python <code>Enum</code>) indicating which JSON schema the <code>uri</code> field points to. <code>Simple</code> is a basic schema; <code>Expanded</code> supports more fields.</p><div class="py"><code>from enum import Enum<br>class MetadataStandard(Enum):<br>    Simple = "simple"<br>    Expanded = "expanded"</code></div>`},
},

/* ============================================================
   token/src/lib.rs
   ============================================================ */
'token_src_lib': {
  1: { title: 'Module doc comment for the Token Program',
    body: `<p>Top-level documentation for the Token program crate. This is the "root" module that wires everything together.</p>`},
  3: { title: 'pub use token_core as core — re-export the core module',
    body: `<p><code>pub use X as Y</code> re-exports an imported item under a new name. This means code using this crate can write <code>token::core::TokenDefinition</code> instead of importing <code>token_core</code> separately.</p><div class="py"><code>from . import token_core as core</code></div>`},
  5: { title: 'pub mod burn — declare the burn submodule',
    body: `<p><code>pub mod name</code> declares a submodule and makes it publicly accessible. Rust looks for a file named <code>burn.rs</code> in the same directory. In Python, this is like having a <code>burn.py</code> file in the same package.</p>`},
  6: { title: 'pub mod initialize — initialize account submodule',
    body: `<p>Declares the <code>initialize</code> submodule, corresponding to <code>initialize.rs</code>. This file handles creating new holding accounts.</p>`},
  7: { title: 'pub mod mint — mint tokens submodule',
    body: `<p>Declares the <code>mint</code> submodule. Handles creating new tokens and adding them to a holding account.</p>`},
  8: { title: 'pub mod new_definition — token definition submodule',
    body: `<p>Declares the <code>new_definition</code> submodule. Handles creating new fungible tokens and NFT definitions.</p>`},
  9: { title: 'pub mod print_nft — NFT printing submodule',
    body: `<p>Declares the <code>print_nft</code> submodule. Handles creating printed copies from an NFT master account.</p>`},
  10: { title: 'pub mod transfer — token transfer submodule',
    body: `<p>Declares the <code>transfer</code> submodule. Handles moving tokens between accounts.</p>`},
  12: { title: 'mod tests — private test module',
    body: `<p>Declares a <code>tests</code> submodule that is <em>private</em> (no <code>pub</code>). This module contains unit tests. In Rust, test code is often kept in a separate <code>tests.rs</code> file within the same crate and excluded from production builds unless you run <code>cargo test</code>.</p>`},
},

/* ============================================================
   token/src/burn.rs
   ============================================================ */
'token_burn': {
  1: { title: 'Imports from nssa_core',
    body: `<p>Importing three types from the LEZ framework:</p><ul style="margin:6px 0 6px 20px"><li><code>AccountWithMetadata</code> — an account plus its metadata (ID, authorization status). Like a Python object wrapping <code>account_id</code>, <code>data</code>, and <code>is_authorized</code></li><li><code>Data</code> — raw bytes</li><li><code>AccountPostState</code> — the desired new state of an account after the function runs. Think of it as a "write instruction" returned to the blockchain runtime</li></ul>`},
  5: { title: 'Imports from token_core',
    body: `<p>Importing the two core data structures needed:</p><ul style="margin:6px 0 6px 20px"><li><code>TokenDefinition</code> — describes the token type (fungible/NFT, total supply)</li><li><code>TokenHolding</code> — describes a user's balance or ownership</li></ul>`},
  7: { title: 'pub fn burn(…) — the burn function',
    body: `<p>This function destroys tokens. It takes three parameters and returns a list of account state updates:</p><div class="py"><code>def burn(<br>    definition_account: AccountWithMetadata,  # the token type<br>    user_holding_account: AccountWithMetadata,  # the user's balance<br>    amount_to_burn: int,<br>) -> list[AccountPostState]: ...</code></div><div class="chain">In LEZ's functional execution model, programs don't modify state directly — they return a list of <code>AccountPostState</code> objects describing the desired new state. The runtime then applies those changes atomically. This is like a pure function that returns a diff rather than mutating in-place.</div>`},
  12: { title: 'assert! — check authorization',
    body: `<p><code>assert!(condition, "message")</code> is identical to Python's <code>assert condition, "message"</code>. If the condition is false, the program panics (crashes with the message). Here it checks that the user has authorized this burn.</p><div class="chain"><code>is_authorized</code> is a flag on <code>AccountWithMetadata</code> indicating that the account's owner has signed this transaction. Without this check, anyone could burn anyone else's tokens.</div>`},
  17: { title: 'TokenDefinition::try_from — deserialize definition account',
    body: `<p>Reads the raw bytes from the definition account and converts them to a <code>TokenDefinition</code> struct. The <code>&amp;</code> prefix means we're passing a reference (pointer) — we're reading the data, not taking ownership.</p><p><code>.expect("…")</code> is like Python's <code>or_else(raise ValueError("…"))</code> — it unwraps a <code>Result</code> and panics with the given message if it's an error. Think of it as a concise <code>try/except</code> that always re-raises.</p>`},
  19: { title: 'TokenHolding::try_from — deserialize holding account',
    body: `<p>Same deserialization pattern for the holding account. Notice both <code>definition</code> and <code>holding</code> are declared <code>mut</code> (mutable) because we'll need to modify them (reduce the balance/supply) before writing back.</p><div class="py"><code>definition = TokenDefinition.from_bytes(definition_account.data)  # may raise<br>holding = TokenHolding.from_bytes(user_holding_account.data)  # may raise</code></div>`},
  22: { title: 'assert_eq! — verify definition matches holding',
    body: `<p><code>assert_eq!(a, b, "msg")</code> checks that <code>a == b</code>, and panics if not — like <code>assert a == b, "msg"</code> in Python. Here it verifies the holding account really belongs to the given definition (prevents burning USDC from a BTC holding account, for example).</p>`},
  28: { title: 'match — dispatch on token type combination',
    body: `<p>This <code>match</code> simultaneously destructures both <code>definition</code> (the token type) and <code>holding</code> (the user's balance). Rust requires all combinations to be handled — the final <code>_ =&gt; panic!</code> catches any invalid (Fungible definition + NftMaster holding) combinations.</p><p>The <code>&amp;mut</code> in <code>match (&amp;mut definition, &amp;mut holding)</code> means we're pattern-matching on mutable references — so we can modify the fields we extract.</p>`},
  40: { title: 'checked_sub — safe subtraction for fungible tokens',
    body: `<p><code>checked_sub(n)</code> returns <code>None</code> if the subtraction would underflow (result would be negative), <code>Some(result)</code> otherwise. <code>.expect("msg")</code> unwraps it — so if the balance is insufficient, the program panics with a descriptive error.</p><div class="py"><code># Python equivalent (Python ints don't overflow, but we validate explicitly):<br>if balance < amount_to_burn:<br>    raise ValueError("Insufficient balance to burn")<br>balance -= amount_to_burn</code></div><p>The <code>*balance =</code> dereferences the mutable reference to actually modify the value — in Python, you'd just write <code>balance -= n</code>.</p>`},
  44: { title: 'Reduce total_supply — global bookkeeping',
    body: `<p>After reducing the holder's balance, we also reduce the token's global <code>total_supply</code>. This keeps the definition account consistent. Burning tokens is deflationary — it permanently removes them from circulation.</p>`},
  92: { title: '_ => panic! — catch invalid type combinations',
    body: `<p>The wildcard arm <code>_ =&gt; panic!</code> catches any combination that wasn't matched above (e.g., a <code>Fungible</code> holding with a <code>NonFungible</code> definition). This should never happen in practice — earlier validation prevents it — but Rust requires all cases to be handled.</p>`},
  94: { title: 'Build post-state for definition account',
    body: `<p>Creates the updated definition account by cloning the account metadata and replacing the data with the newly serialized (modified) definition. <code>Data::from(&amp;definition)</code> runs the Borsh serialization.</p><div class="py"><code>definition_post = definition_account.account.copy()<br>definition_post.data = definition.to_bytes()</code></div>`},
  97: { title: 'Build post-state for holding account',
    body: `<p>Same pattern for the holding account. We serialize the modified holding (with reduced balance) back to bytes.</p>`},
  100: { title: 'Return Vec of AccountPostState — the function\'s "output"',
    body: `<p>The <code>vec![...]</code> macro creates a <code>Vec</code> (list) inline — like Python's <code>[a, b]</code> list literal but as a macro call. We return the two updated account states: first the definition (global supply reduced), then the holding (user's balance reduced).</p><div class="chain">The blockchain runtime receives this list and applies the writes atomically. If anything panics before this return, none of the writes happen — transactions are all-or-nothing.</div>`},
},

/* ============================================================
   token/src/initialize.rs
   ============================================================ */
'token_initialize': {
  1: { title: 'Imports: Account, AccountWithMetadata, Data, AccountPostState',
    body: `<p>Imports three account-related types from <code>nssa_core</code>. <code>Account</code> is the base account struct (without metadata). <code>Account::default()</code> represents an uninitialized/blank account — the equivalent of a null/empty database row.</p>`},
  7: { title: 'pub fn initialize_account — create a blank holding account',
    body: `<p>This function creates a new, empty holding account for a user. It's like opening a new bank account for a specific currency — before this, the user has no account for this token type.</p><div class="py"><code>def initialize_account(<br>    definition_account: AccountWithMetadata,  # the token type<br>    account_to_initialize: AccountWithMetadata,  # must be blank<br>) -> list[AccountPostState]: ...</code></div><div class="chain">On LEZ, you must explicitly initialize an account before you can receive tokens into it. This prevents "ghost" accounts from accumulating dust.</div>`},
  11: { title: 'assert_eq! — verify account is uninitialized',
    body: `<p>Checks that the account we're initializing is truly empty (<code>Account::default()</code> is the zero-value for an account). Prevents accidentally overwriting an existing account.</p><div class="py"><code>assert account_to_initialize.account == Account.default(), "Only Uninitialized accounts..."</code></div>`},
  21: { title: 'Deserialize the token definition',
    body: `<p>Reads the definition account to determine what type of token this is (fungible or NFT). We need this to construct the correct variant of <code>TokenHolding</code>.</p>`},
  23: { title: 'zeroized_from_definition — build empty holding',
    body: `<p>Creates a zero-balance holding of the correct type. For a fungible token, this creates <code>TokenHolding::Fungible { balance: 0 }</code>. For an NFT, it creates <code>TokenHolding::NftPrintedCopy { owned: false }</code>.</p>`},
  26: { title: 'Prepare post-states to return',
    body: `<p>Takes the definition account as-is (unchanged) and the newly initialized holding account (with zero balance), serializes the holding to bytes, and packages them as <code>AccountPostState</code> values.</p><p><code>AccountPostState::new_claimed</code> signals that this is a brand new account being created (claimed from the unclaimed address space), whereas <code>AccountPostState::new</code> updates an existing account.</p>`},
},

/* ============================================================
   token/src/mint.rs
   ============================================================ */
'token_mint': {
  7: { title: 'pub fn mint — create new tokens',
    body: `<p>Creates <code>amount_to_mint</code> new tokens and adds them to a holding account. Increases both the holder's balance and the token's total supply. Only the token definition's authorized owner can call this.</p><div class="py"><code>def mint(<br>    definition_account: AccountWithMetadata,  # must be authorized<br>    user_holding_account: AccountWithMetadata,<br>    amount_to_mint: int,<br>) -> list[AccountPostState]: ...</code></div>`},
  13: { title: 'assert! — require definition authorization',
    body: `<p>Minting requires the definition account to be authorized — only the token issuer (the entity that controls the definition account) can mint new tokens. Without this, anyone could inflate any token's supply.</p><div class="chain">This is like ERC-20's <code>onlyOwner</code> modifier on the <code>mint</code> function. The definition account acts as the token's "mint authority".</div>`},
  19: { title: 'Handle uninitialized holding account',
    body: `<p>This <code>if/else</code> expression handles two cases: if the holding account is blank (uninitialized), we create a new zeroed holding. If it already exists, we deserialize it. The <code>if</code> in Rust returns a value — it's an expression, not just a control flow statement.</p><div class="py"><code>if user_holding_account.account == Account.default():<br>    holding = TokenHolding.zeroized_from_definition(...)<br>else:<br>    holding = TokenHolding.from_bytes(user_holding_account.data)</code></div>`},
  32: { title: 'match — dispatch mint logic by token type',
    body: `<p>Like in <code>burn.rs</code>, we simultaneously match on both definition and holding types. Fungible tokens get their balance and total_supply increased. NFTs panic — you can't mint additional NFTs (you'd use <code>PrintNft</code> instead).</p>`},
  44: { title: 'checked_add — safe addition for minting',
    body: `<p><code>checked_add</code> returns <code>None</code> if the addition would overflow (e.g., the balance becomes larger than <code>u128::MAX</code>). With 128-bit integers, overflow is extraordinarily unlikely for any real token, but the check is there for correctness.</p>`},
  68: { title: 'AccountPostState::new_claimed_if_default',
    body: `<p>A smart constructor that returns <code>new_claimed</code> if the account was previously uninitialized (<code>default</code>), or <code>new</code> if it already existed. This handles the "mint to a new account" case in one call.</p>`},
},

/* ============================================================
   token/src/new_definition.rs
   ============================================================ */
'token_new_definition': {
  9: { title: 'pub fn new_fungible_definition — create a fungible token',
    body: `<p>Creates a brand new fungible token type (like USDC, a game currency, or a governance token). This involves creating two new accounts: a <strong>definition account</strong> (the token's "class") and a <strong>holding account</strong> (the creator's initial balance).</p><div class="chain">When a token is created, the creator immediately receives all <code>total_supply</code> tokens in their holding account. They can then distribute tokens via transfers.</div>`},
  15: { title: 'assert_eq! — verify both accounts are uninitialized',
    body: `<p>Both the definition and holding accounts must be completely blank (uninitialized). These are new accounts being created from scratch — we're "claiming" them.</p>`},
  27: { title: 'Create TokenDefinition::Fungible',
    body: `<p>Constructs the definition value. <code>metadata_id: None</code> means no metadata — this is the simple, metadata-free path. In Rust, <code>None</code> is the absence of a value (Python's <code>None</code>).</p><div class="py"><code>token_definition = FungibleToken(name=name, total_supply=total_supply, metadata_id=None)</code></div>`},
  32: { title: 'Create TokenHolding::Fungible with full balance',
    body: `<p>The creator's holding starts with the <em>entire</em> supply. The holding links to the definition via <code>definition_id: definition_target_account.account_id</code> — this is how we know which token type this holding belongs to.</p>`},
  49: { title: 'pub fn new_definition_with_metadata — create token with metadata',
    body: `<p>A more complete token creation that also creates a <strong>metadata account</strong>. Supports both fungible tokens and NFTs. The three accounts created: definition, holding, and metadata.</p><div class="chain">Metadata accounts store a <code>uri</code> pointing to off-chain JSON (typically on IPFS or Arweave). This JSON contains the token's image, description, and attributes — following standards similar to ERC-721 metadata.</div>`},
  74: { title: 'match on new_definition — handle Fungible vs NonFungible',
    body: `<p>This <code>match</code> returns a <code>(TokenDefinition, TokenHolding)</code> tuple — two values at once. Notice it's assigned to a destructuring pattern <code>let (token_definition, token_holding) = match ...</code>. In Python: <code>token_definition, token_holding = ...</code>.</p><p>For <strong>Fungible</strong>: creates a holding with the full supply. For <strong>NonFungible</strong>: creates an <code>NftMaster</code> holding (the creator holds the printing rights).</p>`},
  102: { title: 'Create TokenMetadata struct',
    body: `<p>Assembles the metadata struct with <code>primary_sale_date: 0u64</code> (the <code>u64</code> suffix is a type annotation on the literal — Python equivalent: just <code>0</code>). The <code>// TODO</code> comment notes this field isn't implemented yet.</p>`},
},

/* ============================================================
   token/src/print_nft.rs
   ============================================================ */
'token_print_nft': {
  7: { title: 'pub fn print_nft — create a printed copy of an NFT',
    body: `<p>This function "prints" a new copy from an NFT master. The master account holds a print allowance (<code>print_balance</code>); each print reduces it by 1. The new printed copy account is created and set to <code>owned: true</code>.</p><div class="chain">Think of an NFT master like a limited-edition print run: the artist holds the master plates and can print up to N copies. Each print creates a new token account (the copy) and decrements the remaining print allowance on the master. This model is similar to Metaplex's "Master Edition" NFTs on Solana.</div>`},
  11: { title: 'assert! — master account must be authorized',
    body: `<p>The caller must own (authorize) the master account — only the NFT holder can print copies. This prevents anyone else from printing from your master.</p>`},
  16: { title: 'assert_eq! — printed account must be uninitialized',
    body: `<p>The destination account for the printed copy must be fresh/blank. You can't print into an existing account.</p>`},
  22: { title: 'Deserialize master account data',
    body: `<p>Reads the master account's data into a <code>TokenHolding</code> value. The <code>mut</code> is needed because we'll modify <code>print_balance</code>.</p>`},
  25: { title: 'Let-else pattern — extract NftMaster or panic',
    body: `<p>This is a "let-else" pattern — it tries to destructure the value as <code>NftMaster</code>, and panics if it's not. It's like writing:</p><div class="py"><code>if not isinstance(master_account_data, NftMaster):<br>    raise ValueError("Invalid Token Holding...")<br>definition_id = master_account_data.definition_id<br>print_balance = master_account_data.print_balance</code></div><p>The <code>&amp;mut</code> means we get mutable references to the fields, so we can modify <code>print_balance</code> in-place.</p>`},
  35: { title: 'Check sufficient print balance',
    body: `<p>Must have more than 1 remaining print balance. Why <code>&gt; 1</code> instead of <code>&gt; 0</code>? One copy is always reserved for the master itself — so if <code>print_balance == 1</code>, it means only the master remains and no more copies can be printed.</p>`},
  39: { title: '*print_balance -= 1 — decrement the print counter',
    body: `<p>Reduces the master's remaining print allowance by 1. The <code>*</code> dereferences the mutable reference — like operating on the value pointed to by a pointer. In Python, you'd just write <code>print_balance -= 1</code> (no dereferencing needed).</p>`},
  45: { title: 'Create NftPrintedCopy holding for new account',
    body: `<p>Creates the new printed copy's holding data: <code>NftPrintedCopy { definition_id, owned: true }</code>. The new copy is immediately "owned" by whoever receives this account.</p><p><code>AccountPostState::new_claimed</code> marks this as a newly created account (vs. updating an existing one).</p>`},
},

/* ============================================================
   token/src/transfer.rs
   ============================================================ */
'token_transfer': {
  7: { title: 'pub fn transfer — move tokens between accounts',
    body: `<p>Transfers <code>balance_to_move</code> tokens from <code>sender</code> to <code>recipient</code>. Handles all three token types (fungible, NFT master, NFT printed copy) with different logic for each.</p><div class="py"><code>def transfer(<br>    sender: AccountWithMetadata,  # must be authorized<br>    recipient: AccountWithMetadata,<br>    balance_to_move: int,<br>) -> list[AccountPostState]: ...</code></div>`},
  13: { title: 'assert! — require sender authorization',
    body: `<p>The sender must have signed the transaction. Without this check, anyone could drain anyone else's tokens. The <code>is_authorized</code> flag is set by the runtime when verifying transaction signatures.</p>`},
  17: { title: 'Handle uninitialized recipient — auto-create holding',
    body: `<p>If the recipient doesn't yet have a holding account for this token, we auto-create one using <code>zeroized_clone_from</code> (same token type, zero balance). This makes transfers more ergonomic — you don't need a separate <code>InitializeAccount</code> step for the recipient.</p><div class="py"><code>if recipient.account == Account.default():<br>    recipient_holding = TokenHolding.zeroized_clone_from(sender_holding)<br>else:<br>    recipient_holding = TokenHolding.from_bytes(recipient.account.data)</code></div>`},
  29: { title: 'match — transfer logic for each token type',
    body: `<p>Three cases:</p><ul style="margin:6px 0 6px 20px"><li><strong>Fungible</strong>: subtract from sender, add to recipient (standard ERC-20 style)</li><li><strong>NftMaster</strong>: swap the entire print_balance (master transfers as a whole unit)</li><li><strong>NftPrintedCopy</strong>: flip ownership flags (sender loses ownership, recipient gains it)</li></ul>`},
  40: { title: 'Fungible transfer: checked_sub and checked_add',
    body: `<p>Deducts from sender and credits to recipient using safe arithmetic. If the sender has insufficient balance, <code>checked_sub</code> returns <code>None</code> and <code>.expect</code> panics with "Insufficient balance".</p>`},
  57: { title: 'NftMaster transfer: swap print balances',
    body: `<p><code>std::mem::swap(a, b)</code> exchanges two values in place — like <code>a, b = b, a</code> in Python. For NFT master transfers, the entire print_balance moves to the recipient. The recipient's account must be empty (zero print_balance) first.</p>`},
  70: { title: 'NftPrintedCopy transfer: flip ownership',
    body: `<p>NFT printed copies track ownership as a boolean. Transfer flips <code>sender_owned</code> to <code>false</code> and <code>recipient_owned</code> to <code>true</code>. Checks ensure the sender actually owns it and the recipient doesn't already own it.</p>`},
  100: { title: 'AccountPostState::new_claimed_if_default',
    body: `<p>If the recipient account was previously uninitialized, this marks it as "newly claimed" so the runtime creates it. If it already existed, it's just updated. Same pattern as in <code>mint.rs</code>.</p>`},
},

/* ============================================================
   amm/core/src/lib.rs
   ============================================================ */
'amm_core_lib': {
  1: { title: 'AMM Program: core data structures module',
    body: `<p>The AMM (Automated Market Maker) is a decentralized exchange mechanism. Instead of a traditional order book, it uses a mathematical formula to automatically price trades. This crate defines the data structures and helper functions.</p><div class="chain">An AMM works like a vending machine — it always has tokens to sell, and prices adjust automatically based on supply and demand according to a formula. The most common is the <strong>constant product formula</strong>: <code>reserve_a × reserve_b = k</code> (constant). When you add Token A, the pool gives you Token B, and the product stays constant.</div>`},
  3: { title: 'Borsh serialization imports',
    body: `<p>Same as the token program — Borsh for on-chain binary serialization of the <code>PoolDefinition</code> struct.</p>`},
  4: { title: 'Import: account and program types from nssa_core',
    body: `<p>The AMM needs more types than the token program: <code>PdaSeed</code> and <code>ProgramId</code> in addition to <code>AccountId</code> and <code>Data</code>.</p><ul style="margin:6px 0 6px 20px"><li><code>PdaSeed</code> — seed bytes for computing a Program Derived Address (PDA)</li><li><code>ProgramId</code> — the deployed address of the AMM program itself</li></ul><div class="chain">PDAs (Program Derived Addresses) are a key blockchain pattern: instead of a user generating a random address, the address is computed deterministically from a program ID and seed bytes. The program "owns" this address and can authorize transactions from it — no private key needed.</div>`},
  10: { title: 'AMM Program Instruction enum',
    body: `<p>The complete API of the AMM program — four operations: create pool, add liquidity, remove liquidity, and swap.</p><div class="chain">The AMM program orchestrates complex multi-step operations. For example, adding liquidity requires transferring two different tokens from the user to the pool's vaults <em>and</em> minting LP (liquidity provider) tokens to the user. The AMM does this by issuing "chained calls" to the Token program — cross-program calls that happen atomically.</div>`},
  23: { title: 'NewDefinition variant — create a new liquidity pool',
    body: `<p>Creates a new AMM pool for a token pair (Token A ↔ Token B). Parameters:</p><ul style="margin:6px 0 6px 20px"><li><code>token_a_amount</code> / <code>token_b_amount</code> — initial liquidity to deposit</li><li><code>amm_program_id</code> — needed to compute deterministic (PDA) addresses for pool accounts</li></ul>`},
  38: { title: 'AddLiquidity variant — add tokens to a pool',
    body: `<p>Adds liquidity to an existing pool in exchange for LP (liquidity provider) tokens. Parameters use "min/max" bounds for slippage protection — the actual amounts deposited are calculated to maintain the pool's ratio.</p><div class="chain">LP tokens represent your share of the pool. If you deposit 10% of the pool's liquidity, you receive 10% of the LP token supply. When you later remove liquidity, you burn LP tokens to withdraw your proportional share of the pool.</div>`},
  50: { title: 'RemoveLiquidity variant — withdraw tokens from a pool',
    body: `<p>Burns LP tokens to withdraw the proportional share of Token A and Token B from the pool. Min bounds protect against slippage.</p>`},
  62: { title: 'Swap variant — exchange one token for another',
    body: `<p>Swaps <code>swap_amount_in</code> of one token for as many of the other token as possible, subject to the constant-product formula. <code>min_amount_out</code> is slippage protection — the transaction fails if you'd receive less.</p><p><code>token_definition_id_in</code> tells the pool which token you're providing (Token A or Token B direction).</p>`},
  78: { title: 'PoolDefinition struct — the pool\'s on-chain state',
    body: `<p>The central data structure for an AMM pool. Think of it as a database row describing one trading pair:</p><div class="py"><code>@dataclass<br>class PoolDefinition:<br>    definition_token_a_id: AccountId  # which token is "A"<br>    definition_token_b_id: AccountId  # which token is "B"<br>    vault_a_id: AccountId  # pool's Token A holding account<br>    vault_b_id: AccountId  # pool's Token B holding account<br>    liquidity_pool_id: AccountId  # LP token definition<br>    liquidity_pool_supply: int  # total LP tokens in circulation<br>    reserve_a: int  # tracked Token A balance<br>    reserve_b: int  # tracked Token B balance<br>    fees: int  # fee rate (unused currently)<br>    active: bool  # False when pool is drained</code></div><div class="chain">The pool has two "vault" accounts (one per token) that hold the actual token balances. The <code>reserve_a</code> and <code>reserve_b</code> values track the last-known balances used in calculations. The constant product <code>k = reserve_a × reserve_b</code> must hold before and after every swap.</div>`},
  79: { title: 'definition_token_a_id / definition_token_b_id fields',
    body: `<p>References to the Token Definition accounts for each side of the pair. These identify <em>which</em> tokens are in the pool (e.g., "USDC" and "ETH").</p>`},
  88: { title: 'fees field — currently unused',
    body: `<p>This field is reserved for trading fees but isn't implemented yet (see the comment). Real AMMs like Uniswap v2 charge 0.3% per swap, distributed to liquidity providers. Fees create the incentive for people to provide liquidity.</p>`},
  91: { title: 'active field — pool liveness flag',
    body: `<p>Set to <code>false</code> when all liquidity is removed (reserves reach zero). An inactive pool can be re-initialized. This prevents division-by-zero errors in the swap formula.</p>`},
  116: { title: 'pub fn compute_pool_pda — deterministic pool address',
    body: `<p>Computes the deterministic address for a pool account from the two token definitions and the AMM program ID. The same inputs always produce the same address — anyone can look up a pool's address without querying the chain.</p><div class="chain">PDAs (Program Derived Addresses) are computed as <code>hash(program_id + seeds)</code>. The AMM program "owns" this address and can authorize writes to it without a private key. This is how programs create and control accounts on behalf of users.</div>`},
  127: { title: 'pub fn compute_pool_pda_seed — the hash-based seed',
    body: `<p>Computes a seed by SHA-256 hashing the two token IDs. The tokens are sorted canonically first (by comparing their byte representations) so the pool for (TokenA, TokenB) is the same as for (TokenB, TokenA). Two pools for the same pair would be wasteful.</p><div class="py"><code>import hashlib<br>def compute_pool_pda_seed(token_a_id, token_b_id):<br>    token_1, token_2 = sorted([token_a_id, token_b_id])<br>    seed_bytes = token_1.to_bytes() + token_2.to_bytes()<br>    return hashlib.sha256(seed_bytes).digest()</code></div>`},
  133: { title: 'match cmp() — sort tokens canonically',
    body: `<p>Compares the byte representations of the two token IDs to put them in a canonical order. <code>cmp()</code> returns <code>Ordering::Less</code>, <code>Greater</code>, or <code>Equal</code> — like Python's <code>__lt__</code>/<code>__gt__</code>/<code>__eq__</code>, but returned as a value you can match on.</p><p>If Equal, the two tokens are the same — panic immediately (you can't create a pool for a token trading against itself).</p>`},
  155: { title: 'pub fn compute_vault_pda — deterministic vault address',
    body: `<p>Computes the address for a vault account (a token-holding account owned by the pool). Each pool has two vaults, one per token. The vault's address is derived from the pool's ID and the token definition ID.</p>`},
  180: { title: 'pub fn compute_liquidity_token_pda — LP token address',
    body: `<p>Computes the deterministic address for the LP (Liquidity Provider) token definition account. The LP token is a special fungible token minted when liquidity is added and burned when removed. Its address is derived from the pool ID hashed with 32 zero bytes.</p>`},
},

/* ============================================================
   amm/src/lib.rs
   ============================================================ */
'amm_src_lib': {
  1: { title: 'AMM Program implementation root',
    body: `<p>The root module for the AMM program implementation. Structurally identical to the token program's lib.rs — declares submodules for each operation.</p>`},
  3: { title: 'pub use amm_core as core — re-export core',
    body: `<p>Makes <code>amm_core</code> accessible as <code>amm::core</code> from outside the crate. The same aliasing pattern as in the token program.</p>`},
  5: { title: 'Submodule declarations',
    body: `<p>Each <code>pub mod</code> line declares a submodule corresponding to a <code>.rs</code> file in the same directory: <code>add.rs</code>, <code>new_definition.rs</code>, <code>remove.rs</code>, <code>swap.rs</code>. <code>mod tests</code> is private (no <code>pub</code>).</p>`},
},

/* ============================================================
   amm/src/add.rs
   ============================================================ */
'amm_add': {
  1: { title: 'Import: NonZeroU128 — type-enforced non-zero value',
    body: `<p><code>NonZeroU128</code> is a wrapper around <code>u128</code> that is <strong>guaranteed at the type level</strong> to be non-zero. In Python, you'd enforce this with <code>assert n != 0</code> at runtime. In Rust, if you declare a parameter as <code>NonZeroU128</code>, it's impossible to call the function with zero — the compiler enforces it.</p><div class="py"><code># Python: runtime check<br>def add_liquidity(min_amount: int, ...):<br>    assert min_amount > 0, "Must be non-zero"</code></div><p>This technique is called "making illegal states unrepresentable" — encoding constraints in types rather than runtime checks.</p>`},
  3: { title: 'AMM core imports',
    body: `<p>Importing <code>PoolDefinition</code> (the pool's state struct) and <code>compute_liquidity_token_pda_seed</code> (needed to authorize LP token minting via PDA seeds).</p>`},
  4: { title: 'nssa_core imports for AMM',
    body: `<p>Two new types introduced in the AMM: <ul style="margin:6px 0 6px 20px"><li><code>ChainedCall</code> — a call to another program (like the Token program) that this transaction will trigger. Think of it as a deferred function call or a sub-transaction.</li><li><code>AccountPostState</code> — the desired final state of an account after execution</li></ul></p><div class="chain">The AMM can't directly modify token balances — only the Token program can do that. Instead, the AMM issues <code>ChainedCall</code> instructions telling the Token program what to do. The blockchain runtime executes these calls atomically after the AMM function returns.</div>`},
  9: { title: '#[expect(…)] — suppress a linter warning',
    body: `<p><code>#[expect(...)]</code> is like a Python <code># noqa: E501</code> comment — it tells the linter "I know about this warning, here's why I'm OK with it". The <code>clippy::too_many_arguments</code> lint fires when a function has more than 7 parameters.</p><p>The <code>reason</code> is documented inline: this is a known code smell that will be fixed later. The <code>TODO: Fix later</code> note is honest about the tech debt.</p>`},
  10: { title: 'pub fn add_liquidity — add tokens to a pool',
    body: `<p>This function adds liquidity to an existing AMM pool. It takes 10 parameters (hence the lint suppression) covering all accounts involved and the desired amounts.</p><p>The function returns a tuple <code>(Vec&lt;AccountPostState&gt;, Vec&lt;ChainedCall&gt;)</code> — a list of account state updates and a list of Token program calls to make. In Python: <code>Tuple[List[AccountPostState], List[ChainedCall]]</code>.</p><div class="chain">Adding liquidity means: (1) deposit Token A from user to pool vault, (2) deposit Token B from user to pool vault, (3) mint LP tokens to user. Steps 1-3 involve the Token program — hence the ChainedCalls.</div>`},
  22: { title: '// 1. Fetch Pool state',
    body: `<p>Step 1: deserialize the pool's current state. If the pool account doesn't contain valid <code>PoolDefinition</code> data, this panics immediately with a descriptive message.</p>`},
  26: { title: 'Validate vault and LP accounts match pool',
    body: `<p>Three <code>assert_eq!</code> checks verify that the accounts passed in actually correspond to this pool. For example: vault_a must be the vault the pool was initialized with. These checks prevent the caller from passing in the wrong accounts (e.g., a different pool's vault).</p>`},
  45: { title: '// 2. Determine deposit amount',
    body: `<p>Step 2: read the actual token balances from the vault accounts. The AMM needs the current vault balances to validate that the pool's tracked reserves match reality.</p>`},
  47: { title: 'Destructure TokenHolding::Fungible from vault_b',
    body: `<p>This <code>let ... = ... else { panic! }</code> pattern extracts <code>vault_b_balance</code> from the token holding. The <code>else</code> branch handles the case where the vault holds an NFT instead of a fungible token — which would be invalid and should panic.</p><p>In Python: <code>if not isinstance(vault_b_holding, Fungible): raise ValueError(…)</code> followed by <code>vault_b_balance = vault_b_holding.balance</code>.</p>`},
  82: { title: '// Calculate actual_amounts — maintain pool ratio',
    body: `<p>When adding liquidity, you can't just add any arbitrary ratio of Token A to Token B — you must maintain the pool's existing ratio, otherwise you'd manipulate the price.</p><p><code>ideal_a</code> = "if I add <code>max_amount_b</code> worth of token B, how much A should I add to maintain the ratio?" This is proportional scaling:</p><div class="py"><code>ideal_a = (reserve_a * max_amount_b) / reserve_b<br>ideal_b = (reserve_b * max_amount_a) / reserve_a</code></div><p>Then we take the minimum — whichever token is the "limiting factor".</p>`},
  113: { title: '// 4. Calculate LP to mint — proportional share',
    body: `<p>LP tokens to mint = proportional to how much liquidity you're adding vs. the total pool size. Calculated separately for Token A and Token B, then we take the minimum to prevent rounding exploits.</p><div class="py"><code>delta_lp = min(<br>    total_lp_supply * actual_a / reserve_a,<br>    total_lp_supply * actual_b / reserve_b,<br>)</code></div><p>If you're adding 1% of the pool's Token A and 1% of Token B, you receive 1% of the LP supply.</p>`},
  125: { title: '// 5. Update pool account — struct update syntax',
    body: `<p>Creates a new <code>PoolDefinition</code> with updated reserves and supply. The <code>..pool_def_data</code> spread syntax copies all other fields unchanged:</p><div class="py"><code># Python equivalent using dataclasses:<br>from dataclasses import replace<br>pool_post_definition = replace(pool_def_data,<br>    liquidity_pool_supply=pool_def_data.liquidity_pool_supply + delta_lp,<br>    reserve_a=pool_def_data.reserve_a + actual_amount_a,<br>    reserve_b=pool_def_data.reserve_b + actual_amount_b,<br>)</code></div>`},
  137: { title: 'ChainedCall for Token A transfer (user → vault)',
    body: `<p>Creates a call to the Token program to transfer Token A from the user's holding to the pool's vault. <code>ChainedCall::new(program_id, accounts, instruction)</code> is like scheduling a function call on the Token program — it will execute atomically after the AMM function returns.</p>`},
  145: { title: 'ChainedCall for Token B transfer (user → vault)',
    body: `<p>Same pattern for Token B. The two transfer calls (A and B) and the LP mint call (below) all execute atomically — either all succeed or none do.</p>`},
  153: { title: 'ChainedCall for LP token minting',
    body: `<p>Instructs the Token program to mint <code>delta_lp</code> LP tokens to the user. The pool definition LP account must be marked as authorized (<code>is_authorized = true</code>) so the Token program accepts the mint request. The <code>.with_pda_seeds(...)</code> provides the PDA seeds that prove the AMM program authorized this call.</p><div class="chain">The AMM program authorizes itself to mint LP tokens by providing the correct PDA seeds. The runtime verifies: "does this seed hash to the account that's acting as LP token authority?" If yes, the mint is permitted. This is how cross-program authorization works without private keys.</div>`},
},

/* ============================================================
   amm/src/new_definition.rs
   ============================================================ */
'amm_new_definition': {
  13: { title: 'pub fn new_definition — create a new AMM pool',
    body: `<p>Creates a brand new liquidity pool for a token pair. This is the most complex operation — it must set up multiple accounts (pool state, two vaults, LP token definition) and do an initial token deposit.</p><div class="chain">When a pool is first created: (1) Token A and Token B are deposited by the creator, (2) the pool's state account is initialized, (3) an LP token is created (or re-used if the pool existed before but was emptied), (4) the creator receives initial LP tokens. Initial LP tokens = √(amount_a × amount_b) — the geometric mean.</div>`},
  27: { title: 'Read token definition IDs from user holdings',
    body: `<p>Extracts which token definitions the user is holding by deserializing their holding accounts. The pool needs to know which tokens it's pairing — this is discovered from the accounts passed in, not hardcoded.</p>`},
  45: { title: 'Verify pool address matches PDA',
    body: `<p>Computes the expected pool PDA and asserts the provided pool account matches. This prevents someone from passing in a fake pool account. The PDA is deterministic — anyone can compute it and verify it's correct.</p>`},
  67: { title: 'Handle both new and re-initialized pools',
    body: `<p>Checks if the pool account is brand new (<code>Account::default()</code>) or is being re-initialized after being drained. If the pool previously existed and its data can be deserialized, do so — but then assert it's inactive (you can't reinitialize an active pool).</p>`},
  80: { title: 'LP Token minting — geometric mean formula',
    body: `<p><code>isqrt()</code> is integer square root. The initial LP supply = √(amount_a × amount_b). This is Uniswap v2's formula — it gives the LP supply a value that is the geometric mean of the two deposits, making it scale-invariant.</p><div class="py"><code>import math<br>initial_lp = int(math.isqrt(token_a_amount * token_b_amount))</code></div><p>Why geometric mean? It means the LP token value doesn't depend on the absolute amounts, just the ratio. 100 units × 100 units = 100 LP tokens, same as 10,000 × 10,000 = 10,000 LP tokens (same ratio).</p>`},
  97: { title: 'AccountPostState::new_claimed vs new',
    body: `<p>If the pool is brand new, use <code>new_claimed</code> (creating a fresh account). If it previously existed (was drained and is being re-initialized), use <code>new</code> (updating the existing account). The ternary-like <code>if ... else ...</code> returns either variant.</p>`},
  123: { title: 'Decide: NewFungibleDefinition vs Mint for LP token',
    body: `<p>If the pool is brand new, the LP token definition doesn't exist yet — use <code>NewFungibleDefinition</code> to create it. If the pool existed before (was drained), the LP token definition already exists — just <code>Mint</code> more LP tokens. Same <code>if/else as expression</code> pattern.</p>`},
},

/* ============================================================
   amm/src/remove.rs
   ============================================================ */
'amm_remove': {
  10: { title: 'pub fn remove_liquidity — withdraw from pool',
    body: `<p>Burns LP tokens to withdraw a proportional share of Token A and Token B from the pool. The reverse of <code>add_liquidity</code>.</p><div class="chain">Removing liquidity: (1) user provides LP tokens to burn, (2) proportional Token A and Token B are transferred from vaults to user, (3) LP tokens are burned, (4) pool reserves are updated. If this removes all remaining liquidity, the pool becomes inactive.</div>`},
  23: { title: 'Convert NonZeroU128 to u128',
    body: `<p><code>let x: u128 = nonzero_val.into()</code> converts a <code>NonZeroU128</code> to a plain <code>u128</code>. The <code>: u128</code> type annotation tells the compiler what type to convert <em>into</em>. In Python, <code>NonZeroU128</code> doesn't exist — you'd just use an int after an assertion check.</p>`},
  45: { title: 'Clone vaults and mark as authorized',
    body: `<p>Creates mutable copies of the vault accounts and sets <code>is_authorized = true</code> on them. The vaults are owned by the pool (a PDA), so the AMM program authorizes them to send tokens to the user. The comment explains why we don't need to recompute PDAs here — the vault IDs are already stored in the pool definition.</p>`},
  60: { title: '// 2. Compute withdrawal amounts — pro-rata',
    body: `<p>The user's LP tokens represent a proportional share of the pool. Withdrawal amounts:</p><div class="py"><code>withdraw_a = (reserve_a * remove_amount) / total_lp_supply<br>withdraw_b = (reserve_b * remove_amount) / total_lp_supply</code></div><p>If you hold 10% of LP tokens, you withdraw 10% of both reserves.</p>`},
  98: { title: '// 4. Calculate delta_lp — LP tokens to burn',
    body: `<p>Calculates how many LP tokens to burn. Note: the formula simplifies to just <code>remove_liquidity_amount</code> itself (supply × amount / supply = amount). This is technically redundant but structured consistently with the add formula.</p>`},
  101: { title: 'active = (remaining supply != 0)',
    body: `<p>After removing liquidity, if the LP supply drops to zero, the pool becomes inactive. The <code>bool</code> expression <code>x != 0</code> evaluates to <code>true</code> or <code>false</code> and is directly assigned to <code>active</code>.</p>`},
  118: { title: 'ChainedCall with pda_seeds — authorized vault withdrawal',
    body: `<p>The vault must transfer tokens <em>out</em> to the user. But the vault is owned by the AMM (a PDA) — so the AMM provides <code>.with_pda_seeds()</code> to prove it's authorized to act on the vault's behalf. This is the PDA authorization pattern: provide the seeds that hash to the vault's PDA address.</p>`},
},

/* ============================================================
   amm/src/swap.rs
   ============================================================ */
'amm_swap': {
  7: { title: 'pub fn swap — exchange one token for another',
    body: `<p>The core AMM operation: the user provides <code>swap_amount_in</code> of one token and receives <code>withdraw_amount</code> of the other, maintaining the constant-product invariant <code>k = reserve_a × reserve_b</code>.</p><div class="chain">The constant-product formula is: <code>new_reserve_out = k / new_reserve_in</code>, where <code>new_reserve_in = reserve_in + amount_in</code>. Rearranging: <code>amount_out = reserve_out × amount_in / (reserve_in + amount_in)</code>. Larger <code>amount_in</code> relative to <code>reserve_in</code> causes more price impact (slippage).</div>`},
  20: { title: 'Verify pool is active and vaults are correct',
    body: `<p>Three checks: pool must be active (not drained), and both vault account IDs must match what the pool definition says. This prevents using the wrong accounts or a dormant pool.</p>`},
  32: { title: 'Read vault balances and validate reserves',
    body: `<p>Reads the actual token balances from the vault accounts. Asserts that the vault balances are at least as large as the pool's tracked reserves. If extra tokens have been donated to a vault, the difference doesn't count — only the reserves matter for pricing.</p>`},
  64: { title: 'Route swap direction — Token A in or Token B in',
    body: `<p>Determines which direction to swap based on <code>token_in_id</code>. This is the most interesting line in the function: it calls <code>swap_logic</code> with the appropriate parameter order (in-vault first, out-vault second) and then packages the result into array patterns.</p><p>The <code>let (calls, [deposit_a, withdraw_a], [deposit_b, withdraw_b]) = if ... else ...</code> simultaneously destructures a tuple and two 2-element arrays. In Python, this would be multiple assignments.</p>`},
  78: { title: '(chained_calls, [deposit_a, 0], [0, withdraw_b]) — Token A in',
    body: `<p>When swapping Token A for Token B: Token A is deposited (deposit_a = swap_amount_in), Token B is withdrawn (withdraw_b = computed amount out). The zeros represent "no change" to the other direction. This structure allows the final reserve update to be written uniformly.</p>`},
  98: { title: 'Update pool reserves — symmetric formula',
    body: `<p>Updates the pool's tracked reserves after the swap. The formula handles both directions uniformly: <code>reserve_a = old_reserve_a + deposit_a - withdraw_a</code>. For a Token A→B swap, <code>deposit_a &gt; 0</code> and <code>withdraw_a = 0</code>, so reserve_a increases. For Token B→A, the opposite.</p>`},
  119: { title: 'fn swap_logic — the constant-product math',
    body: `<p>The core pricing function. Takes the "deposit" side and "withdraw" side of the swap and computes how much to withdraw.</p><p>This is a private function (no <code>pub</code>), used internally by <code>swap</code>.</p>`},
  132: { title: 'Constant-product formula: amount_out',
    body: `<p>The heart of the AMM:</p><div class="py"><code>amount_out = (reserve_out × amount_in) / (reserve_in + amount_in)</code></div><p>This maintains <code>k = reserve_in × reserve_out</code>. As <code>amount_in</code> grows large relative to <code>reserve_in</code>, the marginal output per unit of input decreases — this is the "price impact" or slippage of large trades.</p>`},
  137: { title: 'Slippage check: min_amount_out',
    body: `<p>Rejects the swap if <code>withdraw_amount &lt; min_amount_out</code>. This is the user's slippage protection: "if I'd receive fewer than X tokens, abort." Without this, a front-running attacker could sandwich the trade and steal value.</p>`},
  155: { title: 'Mark vault_withdraw as authorized via PDA',
    body: `<p>The pool's vault needs to send tokens to the user. Since the vault is a PDA (owned by the AMM program), we set <code>is_authorized = true</code> and attach <code>.with_pda_seeds()</code>. The PDA seed for a vault is <code>hash(pool_id, token_definition_id)</code> — computed from the vault's own token holding data.</p>`},
  164: { title: 'Create the outbound transfer ChainedCall',
    body: `<p>Creates the call to the Token program to transfer <code>withdraw_amount</code> from the vault to the user. This is the "receiving end" of the swap — the user gets their output tokens.</p>`},
  175: { title: 'Return (chained_calls, deposit_amount, withdraw_amount)',
    body: `<p>Returns the list of token program calls plus the two amounts, so the caller (<code>swap</code>) can update the pool's reserve tracking. The caller uses these amounts in the symmetric reserve update formula.</p>`},
},
};
