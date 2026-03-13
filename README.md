# LEZ Code Explorer

An interactive, single-page code browser for the **Logos Execution Zone (LEZ)** blockchain programs — the Token Program and the AMM (Automated Market Maker) Program.

Every line of source code is clickable and reveals a Python-friendly explanation of what that line does and why.

## What's Inside

### Token Program

Defines fungible tokens (like ERC-20) and NFTs (like ERC-721), with operations:

| File | Description |
|------|-------------|
| `token/core/src/lib.rs` | Core data structures: `TokenDefinition`, `TokenHolding`, `TokenMetadata`, `Instruction` enum |
| `token/src/lib.rs` | Module exports |
| `token/src/new_definition.rs` | Create new fungible token types and NFTs |
| `token/src/initialize.rs` | Create a blank holding account for a token |
| `token/src/mint.rs` | Mint new fungible tokens |
| `token/src/burn.rs` | Burn tokens (permanently destroy) |
| `token/src/transfer.rs` | Transfer tokens between accounts |
| `token/src/print_nft.rs` | Print a copy of an NFT from a master |

### AMM Program

An Automated Market Maker implementing constant-product (`x·y=k`) swap pools:

| File | Description |
|------|-------------|
| `amm/core/src/lib.rs` | Core data structures: `PoolDefinition`, `Instruction` enum, PDA helpers |
| `amm/src/lib.rs` | Module exports |
| `amm/src/new_definition.rs` | Create a new liquidity pool |
| `amm/src/add.rs` | Add liquidity, receive LP tokens |
| `amm/src/remove.rs` | Remove liquidity by burning LP tokens |
| `amm/src/swap.rs` | Swap one token for another |

## How to Use

Open `index.html` in any modern browser. No server needed — everything is self-contained.

1. Select a file from the sidebar
2. Click any highlighted line to expand an explanation
3. Click again to collapse

## Explanation Philosophy

The explanations assume familiarity with Python and OOP, but no Rust knowledge. Every explanation:

- Provides a **Python equivalent** where applicable
- Explains **Rust concepts** (ownership, match, traits, macros, etc.) in Python terms
- Adds **blockchain context** for domain-specific patterns (accounts, PDAs, token programs, AMMs)

## Technology

Pure HTML/CSS/JavaScript — no frameworks, no build tools, no dependencies. Works entirely from the filesystem (`file://`).

- Dark theme inspired by Catppuccin Mocha
- Custom character-level Rust syntax highlighter
- CSS transitions for smooth expand/collapse animations
- Mobile-responsive layout
