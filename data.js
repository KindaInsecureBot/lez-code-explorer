// LEZ Code Explorer — Source Files & Explanations
// All explanations target Python developers learning Rust + blockchain concepts

const FILES = {

// ─── AMM PROGRAM ─────────────────────────────────────────────────────────────

'amm/core/src/lib.rs': {
  description: 'Core AMM types, instructions, and PDA utility functions',
  code: `//! This crate contains core data structures and utilities for the AMM Program.

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
}`,
  explanations: {
    1: `<strong>Module doc comment.</strong> <code>//!</code> (with <code>!</code>) documents the <em>current</em> module — the file itself. Regular <code>///</code> documents the <em>next</em> item. In Python: <div class="py-eq">"""This module contains core data structures for the AMM Program."""\n# placed at the very top of the file</div>`,
    3: `<strong>Borsh serialization imports.</strong> Borsh (Binary Object Representation Serializer for Hashing) is the binary format used to store data in blockchain accounts — like Python's <code>pickle</code> or <code>struct.pack</code>, but deterministic. The <code>{A, B}</code> braces import multiple items from one crate (Python: <code>from borsh import A, B</code>).`,
    4: `<strong>nssa_core imports.</strong> The LEZ runtime library. <code>AccountId</code> is the unique on-chain address of any account (like an Ethereum address). <code>Data</code> is a fixed-size byte buffer holding serialized account state.`,
    6: `<strong>PdaSeed and ProgramId.</strong> <code>ProgramId</code> = on-chain address of a deployed program. <code>PdaSeed</code> = seed bytes for deriving a Program Derived Address (PDA) — a deterministic address computed from program ID + seed, so both client and program can independently compute it without sharing secrets.`,
    8: `<strong>Serde imports.</strong> Serde is Rust's standard serialization library (like Python's <code>json</code> module). These traits allow converting types to/from JSON or binary formats. Used to encode instructions when submitting transactions.`,
    11: `<strong>#[derive] macro.</strong> Auto-generates trait implementations. <code>#[derive(Serialize, Deserialize)]</code> writes JSON serialization/deserialization automatically — like Python's <code>@dataclass</code> but for serialization. The Rust compiler generates the code at compile time.`,
    12: `<strong>Instruction enum — the program's API.</strong> Rust enums are <em>tagged unions</em>: each variant can carry different typed data. When you call the AMM, you pick one variant and fill in its fields. Think of each variant as a distinct method call: <div class="py-eq">class Instruction(Enum):\n    NEW_DEFINITION = auto()  # but Rust variants carry typed fields</div>`,
    23: `<strong>NewDefinition variant — create a new pool.</strong> Bootstraps a fresh AMM pool for two tokens. The caller provides initial amounts (setting the first price ratio). The geometric mean of the amounts determines initial LP token supply. <code>amm_program_id</code> is needed to verify the PDA-derived pool address.`,
    39: `<strong>AddLiquidity variant — deposit into a pool.</strong> Caller deposits both Token A and Token B in proportion to current reserves, receiving LP tokens representing their pool share. <code>min_amount_liquidity</code> is a slippage guard — transaction fails if the caller would receive fewer LP tokens than this minimum.`,
    55: `<strong>RemoveLiquidity variant — withdraw from a pool.</strong> Caller burns LP tokens and receives back proportional amounts of both tokens. The <code>min_amount_to_remove</code> fields guard against slippage between transaction submission and execution.`,
    71: `<strong>Swap variant — exchange tokens.</strong> The core DEX operation. Caller sends <code>swap_amount_in</code> of one token, receives the other according to the constant-product formula (x×y=k). <code>min_amount_out</code> guards against slippage. <code>token_definition_id_in</code> specifies which token is being sold.`,
    78: `<strong>PoolDefinition derives.</strong> <code>Clone</code> = auto-generates <code>.clone()</code>. <code>Default</code> = zero-value constructor. <code>BorshSerialize/BorshDeserialize</code> = binary encode/decode for on-chain storage. In Python: <div class="py-eq">@dataclass\nclass PoolDefinition:  # Python auto-generates __init__; Rust needs #[derive]</div>`,
    79: `<strong>PoolDefinition struct — the pool's on-chain state.</strong> Stored in the pool's blockchain account. Think of it as a database row. Every swap, deposit, or withdrawal updates this record. The key fields are <code>reserve_a</code>, <code>reserve_b</code> (the AMM balances), and <code>liquidity_pool_supply</code> (total LP tokens outstanding).`,
    86: `<strong>Reserve amounts.</strong> The AMM's tracked balances. The constant product invariant <em>k = reserve_a × reserve_b</em> must be preserved after every swap. These may differ from actual vault balances if extra tokens were sent directly — the AMM only uses reserves for calculations.`,
    93: `<strong>Active flag.</strong> Pool starts <code>active: true</code> and becomes <code>false</code> when all liquidity is withdrawn (reserves hit 0). Inactive pools reject swaps, preventing division-by-zero. In Python: <code>self.active: bool = True</code>.`,
    96: `<strong>impl TryFrom&lt;&Data&gt; for PoolDefinition.</strong> Implements fallible conversion from raw bytes to struct. In Python: <div class="py-eq">@classmethod\ndef from_bytes(cls, data: bytes) -> Optional['PoolDefinition']:\n    return cls.deserialize(data)  # None on failure</div> <code>TryFrom</code> returns <code>Result&lt;Ok, Err&gt;</code>. The <code>type Error</code> line declares the error type.`,
    104: `<strong>impl From&lt;&PoolDefinition&gt; for Data.</strong> Serialize struct to raw bytes for on-chain storage. Infallible (no <code>Try</code> prefix) because writing to a Vec should never fail. In Python: <div class="py-eq">def to_bytes(self) -> bytes:\n    return self.serialize()</div>`,
    116: `<strong>compute_pool_pda — derive the pool's address.</strong> Computes a deterministic address from (program_id, hash(token_a, token_b)). Both the client and the program can compute this independently — no coordination needed. This is how accounts are "pre-agreed": the address is derived mathematically from known inputs.`,
    127: `<strong>compute_pool_pda_seed — canonical token ordering.</strong> A pool for (ETH, USDC) must have the same address as (USDC, ETH). So we sort the tokens before hashing. The match block sorts by comparing raw bytes of AccountIds.`,
    133: `<strong>Sorting tokens to ensure a unique pool per pair.</strong> In Python: <div class="py-eq">if token_a < token_b:\n    t1, t2 = token_b, token_a\nelif token_a > token_b:\n    t1, t2 = token_a, token_b\nelse:\n    raise ValueError("same token")</div> The <code>match</code> expression is Rust's more powerful version of Python's <code>match/case</code>.`,
    154: `<strong>compute_vault_pda — derive a vault's address.</strong> Each pool has two vaults (one per token). Each vault's address is derived from (pool_id, token_definition_id). Vaults are owned by the AMM program — only the AMM can authorize token transfers from them.`,
    180: `<strong>compute_liquidity_token_pda — derive the LP token definition address.</strong> Each pool has one LP token type. Its definition account's address is derived from (pool_id, zeroes). LP tokens represent your share of the pool — deposit to get them, burn them to withdraw.`,
  }
},

'amm/src/lib.rs': {
  description: 'AMM program entry point — re-exports and module declarations',
  code: `//! The AMM Program implementation.

pub use amm_core as core;

pub mod add;
pub mod new_definition;
pub mod remove;
pub mod swap;

mod tests;`,
  explanations: {
    1: `<strong>Module doc comment.</strong> Describes this crate as the AMM program implementation (distinct from <code>amm_core</code> which holds shared types).`,
    3: `<strong>Re-export amm_core as core.</strong> Makes it accessible as <code>amm::core</code>. In Python: <div class="py-eq">from . import amm_core as core  # re-export with alias</div>`,
    5: `<strong>Module declarations.</strong> Each <code>pub mod X;</code> links a file <code>X.rs</code> as a public submodule. In Python: an <code>__init__.py</code> doing <code>from . import add, new_definition, remove, swap</code>. Each module implements one AMM operation.`,
    9: `<strong>Private test module.</strong> Without <code>pub</code>, the tests module is private. Tests compile only in test configuration, excluded from the production binary.`,
  }
},

'amm/src/add.rs': {
  description: 'Add liquidity to an existing AMM pool',
  code: `use std::num::NonZeroU128;

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
}`,
  explanations: {
    1: `<strong>NonZeroU128 import.</strong> A type that guarantees its value is never zero — enforced at the type level, not at runtime. In Python you'd write <code>assert amount > 0</code>. In Rust, using <code>NonZeroU128</code> as a parameter type means zero values are rejected <em>before the function runs</em> — the type system does the validation.`,
    9: `<strong>#[expect(clippy::too_many_arguments)].</strong> Suppresses a Clippy linter warning. Clippy is Rust's linter (like Python's pylint). <code>reason</code> documents why it's silenced — a known TODO. This is better than a blanket suppress because it self-documents the technical debt.`,
    10: `<strong>add_liquidity — deposit tokens into a pool.</strong> Takes 7 account references + 3 numbers. Steps: (1) deserialize pool state, (2) verify all accounts match the pool's stored IDs, (3) compute how much of each token to deposit while maintaining the price ratio, (4) compute LP tokens to mint as a proportion of the pool being added, (5) return updated states + cross-program calls for token transfers. In Python: <div class="py-eq">def add_liquidity(pool, vault_a, vault_b, lp, ua, ub, ulp,\n    min_lp, max_a, max_b) -> tuple[list, list]: ...</div>`,
    11: `<strong>AccountWithMetadata parameter.</strong> Wraps an on-chain account plus: its ID, whether the caller has signing authority (<code>is_authorized</code>), and who the program owner is. In Python: <div class="py-eq">@dataclass\nclass AccountWithMetadata:\n    account_id: AccountId\n    account: Account\n    is_authorized: bool\n    program_owner: ProgramId</div>`,
    21: `<strong>Return type: tuple of two lists.</strong> <code>(Vec&lt;AccountPostState&gt;, Vec&lt;ChainedCall&gt;)</code>. <code>AccountPostState</code> = new state of each account after the operation. <code>ChainedCall</code> = a deferred cross-program invocation (calling the Token program to do actual transfers). In Python: <code>-> tuple[list[AccountPostState], list[ChainedCall]]</code>.`,
    23: `<strong>Deserializing pool account data.</strong> <code>PoolDefinition::try_from(&pool.account.data)</code> reads raw bytes from the pool account and deserializes into a struct. <code>.expect("msg")</code> panics if it fails. In Python: <div class="py-eq">pool_def_data = PoolDefinition.from_bytes(pool.account.data)</div>`,
    48: `<strong>let...else pattern — destructure or panic.</strong> <code>let token_core::TokenHolding::Fungible { balance: vault_b_balance } = vault_b_token_holding else { panic!(...) }</code>. Tries to destructure as the <code>Fungible</code> variant. If it's a different variant (NftMaster, etc.), the <code>else</code> block runs and panics. In Python 3.10+: <div class="py-eq">match holding:\n    case TokenHolding.Fungible(balance=b): vault_b_balance = b\n    case _: raise Exception("Expected Fungible")</div>`,
    83: `<strong>Ideal deposit amounts — constant ratio math.</strong> In an AMM, you must deposit both tokens in the <em>current ratio</em>. These formulas compute the ideal amount of each token: <div class="py-eq">ideal_a = reserve_a * max_b / reserve_b  # how much A pairs with max_b\nideal_b = reserve_b * max_a / reserve_a  # how much B pairs with max_a</div> If the pool is 100 ETH : 200,000 USDC (ratio 1:2000), depositing 1 ETH requires exactly 2000 USDC.`,
    88: `<strong>Choosing actual deposit amounts.</strong> Use the smaller of the two ideals to stay within both budgets. If <code>ideal_a &gt; max_a</code>, the user can't afford enough A for all their B — cap at <code>max_a</code> and compute the matching B. This never exceeds either budget while maintaining the ratio.`,
    113: `<strong>LP token calculation — proportional to contribution.</strong> LP tokens issued = minimum of the two contribution fractions: <div class="py-eq">delta_lp = min(\n    total_supply * actual_a / reserve_a,  # fraction via token A\n    total_supply * actual_b / reserve_b   # fraction via token B\n)</div> Taking the minimum prevents gaming by depositing an unbalanced amount.`,
    126: `<strong>Struct update syntax.</strong> <code>PoolDefinition { reserve_a: new_a, ..pool_def_data }</code> creates a new struct with specified fields changed and the rest spread from <code>pool_def_data</code>. In Python: <div class="py-eq">from dataclasses import replace\nnew_def = replace(pool_def_data, reserve_a=new_a, reserve_b=new_b)</div>`,
    137: `<strong>ChainedCall — cross-program invocation.</strong> The AMM program doesn't directly move tokens — it instructs the Token program via <code>ChainedCall</code>. Like microservices: AMM service asks Token service to transfer. Calls are collected and executed atomically after this function returns.`,
    154: `<strong>Authorizing the LP token definition for minting.</strong> <code>pool_definition_lp_auth.is_authorized = true</code> grants the AMM program authority over the LP definition. Needed because only the definition account authority can mint new LP tokens. Proven via PDA seeds — the program mathematically owns this account.`,
    163: `<strong>.with_pda_seeds() — proving PDA authority.</strong> The AMM proves it controls the LP token definition by providing the seed used to derive its address. The runtime verifies: "program + seed = this account address", granting authorization. No private key needed — math proves ownership.`,
  }
},

'amm/src/new_definition.rs': {
  description: 'Initialize a new AMM liquidity pool',
  code: `use std::num::NonZeroU128;

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
}`,
  explanations: {
    13: `<strong>new_definition — bootstrap a new AMM pool.</strong> Creates a liquidity pool from scratch. Steps: (1) extract which tokens the user holds from their accounts, (2) verify all provided accounts match expected PDA-derived addresses, (3) confirm no active pool exists yet, (4) compute initial LP tokens via geometric mean, (5) transfer seed liquidity to vaults, (6) mint LP tokens to the caller.`,
    26: `<strong>Extracting token definition IDs.</strong> <code>.definition_id()</code> reads inside the user's holding account to find which token type it holds. We don't trust the caller's claim — the accounts themselves carry the type information, and we read it directly. Method chaining: <code>try_from(...)?.definition_id()</code> = Python's <code>TokenHolding.from_bytes(data).definition_id</code>.`,
    44: `<strong>PDA verification — security check.</strong> We recompute the expected PDA for every account and assert it matches. This prevents substituting fake accounts. Without this check, a malicious caller could pass a pool account they control instead of the real one.`,
    67: `<strong>New vs. re-initialized pool.</strong> <code>Account::default()</code> is the "empty/uninitialized" state. If the pool account is empty, create a fresh PoolDefinition. If it's not empty (re-initializing an inactive pool), deserialize the existing data. In Python: <div class="py-eq">pool_data = PoolDefinition() if pool.account == Account() else PoolDefinition.from_bytes(pool.account.data)</div>`,
    80: `<strong>Initial LP — geometric mean.</strong> <code>(a * b).isqrt()</code> = integer square root of a×b. This is Uniswap's formula for the first deposit. Why geometric mean? It makes the LP supply independent of the ratio between the two token prices: <div class="py-eq">import math\ninitial_lp = math.isqrt(token_a_amount * token_b_amount)</div>`,
    98: `<strong>new_claimed vs new AccountPostState.</strong> <code>new_claimed</code> = creating an account that didn't exist before (claiming a new slot on-chain). <code>new</code> = updating an existing account. The distinction prevents double-initialization.`,
    123: `<strong>Conditional LP instruction.</strong> New pool → <code>NewFungibleDefinition</code> (creates the LP token type from scratch). Re-initialized pool → <code>Mint</code> (LP token type exists, just mint more). In Python: <div class="py-eq">if is_new_pool:\n    instr = NewFungibleDefinition("LP Token", initial_lp)\nelse:\n    instr = Mint(initial_lp)</div>`,
  }
},

'amm/src/remove.rs': {
  description: 'Remove liquidity from an AMM pool and receive tokens back',
  code: `use std::num::NonZeroU128;

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
}`,
  explanations: {
    10: `<strong>remove_liquidity — withdraw your share of the pool.</strong> Caller burns LP tokens and receives back proportional amounts of both tokens. Steps: (1) load pool state and verify accounts, (2) authorize vaults for outgoing transfers, (3) compute withdrawal amounts proportional to LP share, (4) slippage check, (5) update pool state, (6) chain-call token transfers from vaults to user + LP burn.`,
    22: `<strong>Shadowing NonZeroU128 to u128.</strong> <code>let remove_liquidity_amount: u128 = remove_liquidity_amount.into()</code> — shadows the parameter with a plain integer. Shadowing (reusing the same variable name) is idiomatic Rust for conversions. <code>.into()</code> = "convert using the Into trait" — like Python's <code>int(x)</code>.`,
    45: `<strong>Authorizing vaults for outgoing transfers.</strong> <code>running_vault_a.is_authorized = true</code> — the AMM grants itself authority over vault accounts. Valid because vaults are PDA-derived from this program's ID, so the program mathematically owns them. Proven via <code>.with_pda_seeds(...)</code> in each chained call.`,
    82: `<strong>Proportional withdrawal amounts.</strong> Each token withdrawn is proportional to the fraction of LP being burned: <div class="py-eq">withdraw_a = reserve_a * lp_to_burn / total_lp_supply\nwithdraw_b = reserve_b * lp_to_burn / total_lp_supply</div> Owning 10% of LP supply = withdrawing 10% of each reserve. Integer division truncates — the pool keeps the dust.`,
    101: `<strong>Pool deactivation.</strong> If the LP supply hits 0 after removal, the pool becomes inactive (<code>active = false</code>). Inactive pools reject swaps, preventing division-by-zero in the AMM math. The pool can be re-initialized via <code>new_definition</code>.`,
    142: `<strong>LP burn via ChainedCall.</strong> Burning LP tokens requires the LP token <em>definition</em> to be authorized (not just the user's holding). The definition tracks total supply, which must decrease. The AMM authorizes itself over the LP definition via PDA seeds.`,
  }
},

'amm/src/swap.rs': {
  description: 'Token swap using the constant-product AMM formula',
  code: `pub use amm_core::{PoolDefinition, compute_liquidity_token_pda_seed, compute_vault_pda_seed};
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
}`,
  explanations: {
    8: `<strong>swap — exchange one token for another.</strong> Public entry point. Determines which token is being sold (A or B), delegates to <code>swap_logic</code> for the constant-product math, then updates pool reserves. Uses a private helper function to avoid duplicating the formula for both swap directions.`,
    64: `<strong>Routing the swap direction.</strong> The caller specifies <code>token_in_id</code> — which token they're selling. Selling A → call <code>swap_logic</code> with (user_a, vault_a, vault_b, user_b). Selling B → flip the arguments. Results are destructured into deposit/withdraw arrays for each reserve, then used to update the pool state.`,
    119: `<strong>swap_logic — private constant-product helper.</strong> <code>fn</code> without <code>pub</code> = private function, only callable within this file. Computes output amount from input, builds the two ChainedCalls (user→vault for input, vault→user for output). The direction-specific logic in <code>swap</code> maps to this generic "deposit X, withdraw Y" helper.`,
    133: `<strong>The constant-product formula.</strong> <code>withdraw = (reserve_out * amount_in) / (reserve_in + amount_in)</code>. Derived from invariant <em>k = x × y</em>. After the swap: <em>(reserve_in + amount_in) × (reserve_out - withdraw) = k</em>. In Python: <div class="py-eq">withdraw = (reserve_out * amount_in) // (reserve_in + amount_in)</div> Larger swaps get worse rates — the price moves as reserves shift. This is intentional: it prevents draining a pool.`,
    157: `<strong>PDA seed for vault withdrawal authorization.</strong> To authorize the vault to send tokens out, we provide the PDA seed that derives its address. We read the token type from the vault's data, then compute the seed. This proves the AMM program "owns" this vault mathematically — no separate private key needed.`,
  }
},

// ─── TOKEN PROGRAM ────────────────────────────────────────────────────────────

'token/core/src/lib.rs': {
  description: 'Core Token types: instructions, definitions, holdings, and metadata',
  code: `//! This crate contains core data structures and utilities for the Token Program.

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
}`,
  explanations: {
    8: `<strong>Instruction enum — the Token Program's API.</strong> Rust enums are <em>tagged unions</em>: each variant carries different typed data. When you call the Token program, you pick one of these variants. Think of each variant as a distinct API method. Unlike Python's <code>Enum</code>, Rust enum variants can hold struct-like fields directly.`,
    15: `<strong>Transfer — move tokens.</strong> Moves <code>amount_to_transfer</code> from sender's holding to recipient's. The sender must be "authorized" (signed the transaction). Unlike Ethereum (where balances live in the token contract), each user here has a separate on-chain account per token type they hold.`,
    22: `<strong>NewFungibleDefinition — deploy a new token type.</strong> Creates a new ERC-20-like fungible token. "Fungible" = each unit is identical, like currency. The creator specifies name and total supply; all tokens go to the creator's account initially.`,
    34: `<strong>Box&lt;NewTokenMetadata&gt; — heap allocation.</strong> <code>Box&lt;T&gt;</code> puts T on the heap and stores just a pointer. In Python, all objects are heap-allocated by default. Here it prevents this enum variant from being much larger than the others — we store a pointer (8 bytes) rather than the full struct inline.`,
    42: `<strong>InitializeAccount — create an empty holding account.</strong> Before receiving a token, a user needs a dedicated "wallet slot". This creates it with zero balance. On LEZ, each token type requires a separate account per user (similar to Solana's Associated Token Account model).`,
    47: `<strong>Burn — permanently destroy tokens.</strong> Reduces both the holder's balance AND the token's total supply. Irreversible. Used by the AMM to retire LP tokens when liquidity is withdrawn.`,
    54: `<strong>Mint — create new tokens.</strong> Only the <em>definition account holder</em> (the "mint authority") can mint. The AMM uses this to mint LP tokens to depositors. Not available for NFTs — use PrintNft instead.`,
    60: `<strong>PrintNft — create an edition of an NFT.</strong> NFTs have "master" copies and "printed" editions. The master holds a <code>print_balance</code> that decrements with each print. Like a printing press: the master is the plate, each call creates a new numbered edition.`,
    65: `<strong>NewTokenDefinition enum — input for token creation.</strong> Used only as input to <code>NewDefinitionWithMetadata</code>. Separates creation parameters from the stored definition. Fungible tokens specify <code>total_supply</code>; Non-fungible tokens specify <code>printable_supply</code> (how many editions can be printed).`,
    77: `<strong>TokenDefinition enum — the on-chain master record for a token type.</strong> Stored in a dedicated blockchain account. Think of it as the "contract": Fungible tokens have a running <code>total_supply</code> and optional metadata. NFTs have a <code>printable_supply</code> and required metadata. <code>Option&lt;AccountId&gt;</code> = either <code>Some(id)</code> or <code>None</code> (like Python's <code>Optional[AccountId]</code>).`,
    84: `<strong>NonFungible variant — NFT type definition.</strong> Each NFT type has a fixed <code>printable_supply</code> (number of editions possible). NFTs always require metadata — there's no <code>Option</code> wrapper on <code>metadata_id</code>, making it mandatory at the type level.`,
    111: `<strong>TokenHolding enum — a user's account for a specific token.</strong> Three variants: <code>Fungible</code> (holds a balance), <code>NftMaster</code> (holds the original "printing plate"), <code>NftPrintedCopy</code> (holds one specific edition). Each variant has different fields appropriate to that kind of ownership.`,
    116: `<strong>NftMaster holding — you own the original.</strong> <code>print_balance</code> counts remaining printable editions. Starts at <code>printable_supply - 1</code> (one slot reserved for the master itself). Each <code>PrintNft</code> call decrements it. At 0, no more editions can be created.`,
    121: `<strong>NftPrintedCopy holding — you own one specific copy.</strong> A boolean <code>owned: bool</code> — you either own this copy or you don't. When transferred, the <code>owned</code> flag moves from sender to recipient. It's not a quantity but an ownership flag.`,
    130: `<strong>zeroized_clone_from — create empty holding matching an existing one's type.</strong> Creates a new holding with the same token type but zero/empty values. Used when transferring to a recipient who has no account yet. The <code>..</code> in match patterns ignores remaining fields — like Python's <code>*_</code> in a case clause. In Python: <div class="py-eq">@classmethod\ndef zeroized_clone_from(cls, other):\n    return cls(definition_id=other.definition_id, balance=0)</div>`,
    147: `<strong>zeroized_from_definition — create empty holding from a token definition.</strong> Given a TokenDefinition, creates the matching holding variant with zero values. Fungible → <code>balance=0</code>. NonFungible → <code>owned=false</code>. The match decides which variant based on the definition type.`,
    163: `<strong>definition_id method — extract token type from any holding variant.</strong> All three variants store <code>definition_id</code> but in different positions. This method extracts it regardless of variant. The <code>*definition_id</code> copies the value out of the reference — Rust requires explicit dereferencing. In Python: <div class="py-eq">@property\ndef definition_id(self): return self._definition_id</div>`,
    192: `<strong>NewTokenMetadata — input struct for metadata.</strong> Provided by the caller when creating a token with metadata. <code>uri</code> = link to off-chain JSON (e.g., IPFS: <code>ipfs://Qm...</code>). <code>standard</code> = which JSON schema to expect. <code>creators</code> = attribution string. In Python: <div class="py-eq">@dataclass\nclass NewTokenMetadata:\n    standard: MetadataStandard\n    uri: str\n    creators: str</div>`,
    202: `<strong>TokenMetadata — on-chain metadata record.</strong> The permanent stored version. Adds <code>definition_id</code> (back-reference to the token) and <code>primary_sale_date</code> (currently always 0 — a known TODO). Stored in a separate account from the token definition to keep account sizes manageable.`,
    217: `<strong>MetadataStandard enum — format selector.</strong> Specifies the expected JSON schema at the URI. <code>Simple</code> = basic fields (name, image, description). <code>Expanded</code> = additional NFT attributes. Like a content-type header telling clients how to parse the off-chain data.`,
  }
},

'token/src/lib.rs': {
  description: 'Token program entry point — module declarations',
  code: `//! The Token Program implementation.

pub use token_core as core;

pub mod burn;
pub mod initialize;
pub mod mint;
pub mod new_definition;
pub mod print_nft;
pub mod transfer;

mod tests;`,
  explanations: {
    3: `<strong>Re-export token_core as core.</strong> Makes it accessible as <code>token::core</code>. The AMM program imports <code>token_core</code> directly to use the types without importing the full program implementation.`,
    5: `<strong>Public module declarations.</strong> Each <code>pub mod X;</code> links a file <code>X.rs</code> as a public submodule. The Token Program's full API: burn, initialize, mint, new_definition, print_nft, transfer. In Python: <div class="py-eq"># __init__.py\nfrom . import burn, initialize, mint, new_definition, print_nft, transfer</div>`,
    11: `<strong>Private test module.</strong> Without <code>pub</code>, tests are private and compiled only in test configuration.`,
  }
},

'token/src/burn.rs': {
  description: 'Burn (permanently destroy) tokens from a holding account',
  code: `use nssa_core::{
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
}`,
  explanations: {
    7: `<strong>burn — permanently destroy tokens.</strong> Three cases handled: (1) Fungible — reduce holder's balance + token's total supply. (2) NFT Master — reduce printable_supply + print_balance. (3) NFT Printed Copy — set owned=false, reduce supply. Both the definition AND the holding are deserialized, modified, and written back.`,
    12: `<strong>Authorization check.</strong> <code>is_authorized</code> = the caller signed the transaction for this account. Without this, anyone could burn your tokens. In Python: <div class="py-eq">assert user_holding_account.is_authorized, "Authorization is missing"</div>`,
    17: `<strong>let mut — mutable variable binding.</strong> In Python, variables are mutable by default. In Rust, <code>let</code> creates an <em>immutable</em> binding — you must add <code>mut</code> to allow modification. This makes it obvious at a glance which values change. The compiler enforces this.`,
    28: `<strong>Match on both definition and holding simultaneously.</strong> Matches <em>two</em> values at once to ensure they're compatible types. In Python 3.10+: <div class="py-eq">match (definition, holding):\n    case (TokenDefinition.Fungible(...), TokenHolding.Fungible(...)):\n        # handle fungible\n    case (TokenDefinition.NonFungible(...), TokenHolding.NftMaster(...)):\n        # handle NFT master</div>`,
    40: `<strong>checked_sub — safe subtraction.</strong> Returns <code>None</code> on underflow, <code>Some(result)</code> otherwise. <code>.expect("msg")</code> panics with the message if it's <code>None</code>. In Python: <div class="py-eq">if balance < amount:\n    raise Exception("Insufficient balance")\nbalance -= amount</div> Regular Rust subtraction panics in debug mode on underflow — <code>checked_sub</code> makes the handling explicit.`,
    74: `<strong>Burning an NFT printed copy.</strong> "Burning" a copy means renouncing ownership. You can only burn exactly 1 (you can't partially own an NFT). <code>printable_supply</code> on the definition decreases. <code>*owned = false</code> — the <code>*</code> dereferences a mutable reference obtained via pattern matching.`,
    91: `<strong>Catch-all panic arm.</strong> <code>_ =&gt; panic!(...)</code> handles impossible combinations (e.g., Fungible definition + NftMaster holding). Rust's exhaustive matching requires covering all combinations — this arm documents that mismatches are bugs.`,
  }
},

'token/src/initialize.rs': {
  description: 'Initialize an empty token holding account for a user',
  code: `use nssa_core::{
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
}`,
  explanations: {
    7: `<strong>initialize_account — create a zero-balance holding account.</strong> Before receiving a token, a user needs an empty "wallet slot" for that token type. On LEZ (inspired by Solana), each user needs a separate account per token type — you can't receive USDC until you've initialized a USDC holding account. Different from Ethereum where all balances live inside the token contract.`,
    11: `<strong>Assert account is uninitialized.</strong> <code>Account::default()</code> = empty state. Prevents re-initializing an existing account (which would wipe the balance). In Python: <div class="py-eq">assert account_to_initialize.account == Account(), "Only uninitialized accounts can be initialized"</div>`,
    23: `<strong>zeroized_from_definition — create the right holding type.</strong> Given the token definition, creates the matching holding variant with zero values. Fungible → <code>TokenHolding::Fungible { balance: 0 }</code>. NonFungible → <code>TokenHolding::NftPrintedCopy { owned: false }</code>. The definition type determines which holding variant to create.`,
    32: `<strong>AccountPostState::new_claimed — create a new on-chain account.</strong> Signals this account is being created for the first time. The runtime allocates the account on-chain. Without "claimed", it would just update an existing account.`,
  }
},

'token/src/mint.rs': {
  description: 'Mint new tokens — increase supply and recipient balance',
  code: `use nssa_core::{
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
}`,
  explanations: {
    7: `<strong>mint — create new tokens.</strong> Only the <em>definition account holder</em> (the "mint authority") can mint — not the recipient. The AMM uses this to create LP tokens for depositors. Minting is only allowed for fungible tokens — NFTs use <code>PrintNft</code> instead.`,
    12: `<strong>Definition must be authorized, not the user.</strong> <code>definition_account.is_authorized</code> — it's the <em>token creator</em> who must sign, not the recipient. You can mint tokens into anyone's account without their permission. This is how the AMM mints LP tokens to depositors — the AMM controls the LP definition via PDA.`,
    19: `<strong>Auto-create holding if needed.</strong> If the recipient account is empty (default), we create a zero-balance holding on the fly. Otherwise, load the existing holding and add to it. Allows minting directly to an uninitialized account — one fewer setup step: <div class="py-eq">holding = (\n    TokenHolding.zeroed(definition_id)\n    if recipient.account == Account()\n    else TokenHolding.from_bytes(recipient.data)\n)</div>`,
    53: `<strong>NFT mint forbidden.</strong> <code>panic!("Cannot mint additional supply for Non-Fungible Tokens")</code>. NFTs have a fixed supply set at creation. Use <code>PrintNft</code> for editions. The <code>|</code> in the pattern = "match either" — like Python's <code>case NftMaster() | NftPrintedCopy():</code>.`,
    69: `<strong>new_claimed_if_default.</strong> If the holding account was originally empty, mark it as newly claimed (creating on-chain). If it already existed, just update. Handles both "first mint to this account" and "add to existing balance" cases.`,
  }
},

'token/src/new_definition.rs': {
  description: 'Create new fungible or non-fungible token definitions',
  code: `use nssa_core::{
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
}`,
  explanations: {
    9: `<strong>new_fungible_definition — deploy a simple token type.</strong> Creates two accounts: TokenDefinition (the "contract" record, no metadata) and a TokenHolding for the creator with the full initial supply. All tokens go to the creator — they distribute via transfers. In Python: <div class="py-eq">def deploy_token(name: str, total_supply: int):\n    defn = TokenDefinition.Fungible(name, total_supply, metadata_id=None)\n    holding = TokenHolding.Fungible(defn.id, balance=total_supply)\n    return claim_accounts(defn, holding)</div>`,
    27: `<strong>Struct literal syntax.</strong> <code>TokenDefinition::Fungible { name, total_supply, metadata_id: None }</code>. In Python: <code>TokenDefinition.Fungible(name=name, total_supply=total_supply, metadata_id=None)</code>. <code>None</code> in Rust is written as <code>None</code> for the <code>Option</code> type — same as Python. When field name equals variable name, Rust allows shorthand: <code>{ name }</code> = <code>{ name: name }</code>.`,
    32: `<strong>Creator gets the full initial supply.</strong> The holding belongs to the deployer. Balance = <code>total_supply</code> — they own everything initially, then distribute via transfers. Like an ICO: deploy and hold all supply, then sell/distribute.`,
    49: `<strong>new_definition_with_metadata — deploy token + metadata.</strong> Like the simple version but also creates a metadata account. Supports both fungible tokens with artwork and NFTs. Takes 3 target accounts instead of 2. The match determines whether to create a fungible token (with balance) or an NFT (with print_balance).`,
    74: `<strong>Match on definition type to build the right holding.</strong> Fungible → creator gets <code>TokenHolding::Fungible { balance: total_supply }</code>. NonFungible → creator gets <code>TokenHolding::NftMaster { print_balance: printable_supply }</code> (the "printing plate"). The tuple syntax <code>(definition, holding)</code> returns both from the match expression.`,
    97: `<strong>NFT creator gets the master holding.</strong> <code>print_balance: printable_supply</code> — the creator gets the master with all print slots available. Each call to <code>PrintNft</code> uses one slot, creating a new <code>NftPrintedCopy</code> account for the recipient.`,
  }
},

'token/src/print_nft.rs': {
  description: 'Print a new NFT edition from an existing master',
  code: `use nssa_core::{
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
}`,
  explanations: {
    7: `<strong>print_nft — create a limited edition NFT copy.</strong> Takes an NftMaster (the original) and an empty account (for the new copy). Decrements the master's <code>print_balance</code> and creates a new <code>NftPrintedCopy</code> with <code>owned: true</code>. Like a printing press: each call uses one print slot. The master account holder (creator) controls this via authorization.`,
    25: `<strong>let...else pattern — destructure or panic.</strong> Tries to destructure <code>master_account_data</code> as <code>NftMaster</code>. If it's a different variant, the <code>else</code> block runs (and must diverge — here it panics). In Python 3.10+: <div class="py-eq">match master_account_data:\n    case TokenHolding.NftMaster(definition_id=d, print_balance=p):\n        definition_id, print_balance = d, p\n    case _:\n        raise Exception("Invalid Token Holding")</div>`,
    33: `<strong>Copying definition_id out of a borrow.</strong> <code>let definition_id = *definition_id;</code> — the <code>*</code> dereferences and copies the value. We copy it because <code>definition_id</code> is borrowed from <code>master_account_data</code>, which we're about to mutate. By copying first, we can use it later without borrow conflicts. Python doesn't have this distinction.`,
    36: `<strong>print_balance &gt; 1, not &gt; 0.</strong> The last slot is reserved for the master itself — you can't print the very last one. Then <code>*print_balance -= 1</code> decrements via a mutable reference. The <code>*</code> dereferences to modify the value behind the reference obtained from the pattern match.`,
    45: `<strong>Creating the NftPrintedCopy.</strong> <code>owned: true</code> — whoever triggers this print immediately owns the copy. <code>definition_id</code> links to the NFT type definition (metadata URI, creators). <code>AccountPostState::new_claimed</code> = this is a brand new account being created.`,
  }
},

'token/src/transfer.rs': {
  description: 'Transfer tokens between holding accounts',
  code: `use nssa_core::{
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
}`,
  explanations: {
    7: `<strong>transfer — move tokens from sender to recipient.</strong> Handles all three token types: (1) Fungible — subtract from sender, add to recipient. (2) NFT Master — swap the entire print balance (full ownership transfer). (3) NFT Printed Copy — flip the <code>owned</code> boolean. The sender must be authorized; the recipient does not need to pre-initialize their account.`,
    12: `<strong>Sender authorization.</strong> Only the account's owner (proven by transaction signature) can send. <code>is_authorized</code> is set by the runtime when the transaction includes the account owner's signature. In blockchain terms: you must "sign" to authorize spending.`,
    17: `<strong>Auto-create recipient holding if needed.</strong> If the recipient account is uninitialized (<code>Account::default()</code>), we create a zero-balance holding with the same token type as the sender. You can send tokens to someone who hasn't explicitly set up a holding account yet. <code>zeroized_clone_from</code> copies the token type but zeroes values.`,
    29: `<strong>Three-way match — handle all token type combinations.</strong> Rust requires exhaustive matching. Valid combinations: Fungible+Fungible, NftMaster+NftMaster, NftPrintedCopy+NftPrintedCopy. The final <code>_ =&gt; panic!</code> handles impossible combinations (e.g., Fungible+NftMaster).`,
    66: `<strong>std::mem::swap — transfer NFT master ownership.</strong> For NFT masters, we swap the print balances between sender and recipient. The recipient must start with 0 (you can't merge two masters). <code>std::mem::swap</code> exchanges two values in-place via mutable references — like Python's <code>a, b = b, a</code>. After: sender has 0, recipient has the full balance.`,
    78: `<strong>NFT printed copy transfer — flip ownership boolean.</strong> You either own this specific copy or you don't. Transfer: assert sender owns it, assert recipient doesn't, then flip both flags. <code>balance_to_move</code> must be exactly 1 — you can't partially own an NFT. In Python: <div class="py-eq">assert sender_owned; assert not recipient_owned\nsender_owned = False; recipient_owned = True</div>`,
  }
},

}; // end FILES
