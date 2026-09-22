cat << 'INNER_EOF' > programs/prepay_contract/src/state.rs
use anchor_lang::prelude::*;

#[account]
pub struct GlobalConfig {
    pub authority: Pubkey,
    pub pusd_mint: Pubkey,
    pub paused: bool,
    pub bump: u8,
    pub assets: Vec<AssetConfig>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct AssetConfig {
    pub mint: Pubkey,
    pub symbol: [u8; 16],
    pub ltv_bps: u16,
    pub enabled: bool,
}

#[account]
pub struct UserPosition {
    pub owner: Pubkey,
    pub collateral_mint: Pubkey,
    pub collateral_amount: u64,
    pub debt: u64,
    pub bump: u8,
}

#[account]
pub struct MockOracle {
    pub authority: Pubkey,
    pub asset_mint: Pubkey,
    pub price: u64, // price scaled by 10^6
    pub decimals: u8,
}
INNER_EOF

cat << 'INNER_EOF' > programs/prepay_contract/src/error.rs
use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("The protocol is currently paused")]
    ProtocolPaused,
    #[msg("Asset is not supported")]
    UnsupportedAsset,
    #[msg("Asset is disabled")]
    AssetDisabled,
    #[msg("Wrong collateral mint")]
    WrongCollateralMint,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Insufficient collateral to support this debt")]
    InsufficientCollateral,
    #[msg("Insufficient debt for this operation")]
    InsufficientDebt,
    #[msg("Math overflow occurred")]
    MathOverflow,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Invalid Oracle Account")]
    InvalidOracle,
}
INNER_EOF

cat << 'INNER_EOF' > programs/prepay_contract/src/lib.rs
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, MintTo, Burn};
use std::str::FromStr;

pub mod state;
pub mod error;

use state::*;
use error::*;

declare_id!("AmsV8UeyWRD6g7NZKMF4Z78h2xN7jQDweN1Bujn5VBwS");

#[program]
pub mod prepay_contract {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config = &mut ctx.accounts.global_config;
        config.authority = ctx.accounts.authority.key();
        config.pusd_mint = ctx.accounts.pusd_mint.key();
        config.paused = false;
        config.bump = ctx.bumps.global_config;

        let mut assets = Vec::new();

        let asset_list = [
            ("ANDURIL", "PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB", 6000),
            ("ANTHROPIC", "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw", 6000),
            ("FIGUREAI", "PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd", 5500),
            ("KALSHI", "PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua", 5000),
            ("NEURALINK", "PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HWS4HJbw9S", 5000),
            ("OPENAI", "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF", 6000),
            ("POLYMARKET", "Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP", 5000),
        ];

        for (sym, mint_str, ltv) in asset_list.iter() {
            let mut symbol_arr = [0u8; 16];
            let sym_bytes = sym.as_bytes();
            symbol_arr[..sym_bytes.len()].copy_from_slice(sym_bytes);
            assets.push(AssetConfig {
                mint: Pubkey::from_str(mint_str).unwrap(),
                symbol: symbol_arr,
                ltv_bps: *ltv,
                enabled: true,
            });
        }

        config.assets = assets;

        Ok(())
    }

    pub fn init_user_position(ctx: Context<InitUserPosition>) -> Result<()> {
        let config = &ctx.accounts.global_config;
        let position = &mut ctx.accounts.user_position;
        
        let asset = config.assets.iter().find(|a| a.mint == ctx.accounts.collateral_mint.key())
            .ok_or(ErrorCode::UnsupportedAsset)?;
        
        position.owner = ctx.accounts.user.key();
        position.collateral_mint = asset.mint;
        position.collateral_amount = 0;
        position.debt = 0;
        position.bump = ctx.bumps.user_position;

        Ok(())
    }

    pub fn deposit_collateral(ctx: Context<DepositCollateral>, amount: u64) -> Result<()> {
        let config = &ctx.accounts.global_config;
        require!(!config.paused, ErrorCode::ProtocolPaused);
        require!(amount > 0, ErrorCode::InvalidAmount);

        let asset = config.assets.iter().find(|a| a.mint == ctx.accounts.collateral_mint.key())
            .ok_or(ErrorCode::UnsupportedAsset)?;
        require!(asset.enabled, ErrorCode::AssetDisabled);

        let position = &mut ctx.accounts.user_position;
        require!(position.collateral_mint == ctx.accounts.collateral_mint.key(), ErrorCode::WrongCollateralMint);

        let cpi_accounts = Transfer {
            from: ctx.accounts.user_collateral_ata.to_account_info(),
            to: ctx.accounts.collateral_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        position.collateral_amount = position.collateral_amount.checked_add(amount).ok_or(ErrorCode::MathOverflow)?;

        Ok(())
    }

    pub fn mint_pusd(ctx: Context<MintPusd>, amount: u64) -> Result<()> {
        let config = &ctx.accounts.global_config;
        require!(!config.paused, ErrorCode::ProtocolPaused);
        require!(amount > 0, ErrorCode::InvalidAmount);

        let position = &mut ctx.accounts.user_position;
        let asset = config.assets.iter().find(|a| a.mint == position.collateral_mint)
            .ok_or(ErrorCode::UnsupportedAsset)?;
        require!(asset.enabled, ErrorCode::AssetDisabled);

        // Temporary Oracle Mechanism:
        // We use a MockOracle account initialized by admin for the MVP.
        let oracle = &ctx.accounts.oracle;
        require!(oracle.asset_mint == position.collateral_mint, ErrorCode::InvalidOracle);
        let price = oracle.price; // price of 1 token scaled by 10^6
        
        // Calculate collateral value in USD scaled by 10^6
        // PreStock tokens have 6 decimals.
        // collateral_amount is in 10^-6 tokens.
        // So (collateral_amount / 10^6) * price = USD value.
        // value_usd = (collateral_amount * price) / 10^6
        let value_usd = (position.collateral_amount as u128)
            .checked_mul(price as u128).ok_or(ErrorCode::MathOverflow)?
            .checked_div(1_000_000).ok_or(ErrorCode::MathOverflow)?;

        let max_debt = value_usd
            .checked_mul(asset.ltv_bps as u128).ok_or(ErrorCode::MathOverflow)?
            .checked_div(10000).ok_or(ErrorCode::MathOverflow)?;

        let new_debt = (position.debt as u128)
            .checked_add(amount as u128).ok_or(ErrorCode::MathOverflow)?;

        require!(new_debt <= max_debt, ErrorCode::InsufficientCollateral);

        position.debt = new_debt as u64;

        let seeds = &[b"global_config".as_ref(), &[config.bump]];
        let signer = &[&seeds[..]];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.pusd_mint.to_account_info(),
            to: ctx.accounts.user_pusd_ata.to_account_info(),
            authority: ctx.accounts.global_config.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::mint_to(cpi_ctx, amount)?;

        Ok(())
    }

    pub fn burn_pusd(ctx: Context<BurnPusd>, amount: u64) -> Result<()> {
        let config = &ctx.accounts.global_config;
        require!(!config.paused, ErrorCode::ProtocolPaused);
        require!(amount > 0, ErrorCode::InvalidAmount);

        let position = &mut ctx.accounts.user_position;
        require!(amount <= position.debt, ErrorCode::InsufficientDebt);

        let cpi_accounts = Burn {
            mint: ctx.accounts.pusd_mint.to_account_info(),
            from: ctx.accounts.user_pusd_ata.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::burn(cpi_ctx, amount)?;

        position.debt = position.debt.checked_sub(amount).unwrap();

        Ok(())
    }

    pub fn withdraw_collateral(ctx: Context<WithdrawCollateral>, amount: u64) -> Result<()> {
        let config = &ctx.accounts.global_config;
        require!(!config.paused, ErrorCode::ProtocolPaused);
        require!(amount > 0, ErrorCode::InvalidAmount);

        let position = &mut ctx.accounts.user_position;
        require!(amount <= position.collateral_amount, ErrorCode::InsufficientCollateral);

        let asset = config.assets.iter().find(|a| a.mint == position.collateral_mint)
            .ok_or(ErrorCode::UnsupportedAsset)?;

        // Temporary Oracle Mechanism:
        let oracle = &ctx.accounts.oracle;
        require!(oracle.asset_mint == position.collateral_mint, ErrorCode::InvalidOracle);
        let price = oracle.price;
        
        let remaining_collateral = position.collateral_amount.checked_sub(amount).unwrap();
        
        let value_usd = (remaining_collateral as u128)
            .checked_mul(price as u128).ok_or(ErrorCode::MathOverflow)?
            .checked_div(1_000_000).ok_or(ErrorCode::MathOverflow)?;

        let max_debt = value_usd
            .checked_mul(asset.ltv_bps as u128).ok_or(ErrorCode::MathOverflow)?
            .checked_div(10000).ok_or(ErrorCode::MathOverflow)?;

        require!((position.debt as u128) <= max_debt, ErrorCode::InsufficientCollateral);

        position.collateral_amount = remaining_collateral;

        let seeds = &[b"global_config".as_ref(), &[config.bump]];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.collateral_vault.to_account_info(),
            to: ctx.accounts.user_collateral_ata.to_account_info(),
            authority: ctx.accounts.global_config.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, amount)?;

        Ok(())
    }

    // Mock Oracle Update for testing
    pub fn update_oracle(ctx: Context<UpdateOracle>, price: u64) -> Result<()> {
        let oracle = &mut ctx.accounts.oracle;
        oracle.price = price;
        Ok(())
    }

    pub fn init_oracle(ctx: Context<InitOracle>, price: u64) -> Result<()> {
        let oracle = &mut ctx.accounts.oracle;
        oracle.authority = ctx.accounts.authority.key();
        oracle.asset_mint = ctx.accounts.asset_mint.key();
        oracle.price = price;
        oracle.decimals = 6;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 1 + 1 + 4 + (7 * (32 + 16 + 2 + 1)),
        seeds = [b"global_config"],
        bump
    )]
    pub global_config: Account<'info, GlobalConfig>,

    pub pusd_mint: Account<'info, Mint>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitUserPosition<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 8 + 8 + 1,
        seeds = [b"position", user.key().as_ref(), collateral_mint.key().as_ref()],
        bump
    )]
    pub user_position: Account<'info, UserPosition>,

    pub collateral_mint: Account<'info, Mint>,
    
    pub global_config: Account<'info, GlobalConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositCollateral<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub global_config: Account<'info, GlobalConfig>,
    
    #[account(
        mut,
        seeds = [b"position", user.key().as_ref(), collateral_mint.key().as_ref()],
        bump = user_position.bump,
    )]
    pub user_position: Account<'info, UserPosition>,
    
    pub collateral_mint: Account<'info, Mint>,

    #[account(mut)]
    pub user_collateral_ata: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub collateral_vault: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct MintPusd<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(seeds = [b"global_config"], bump = global_config.bump)]
    pub global_config: Account<'info, GlobalConfig>,
    
    #[account(
        mut,
        seeds = [b"position", user.key().as_ref(), user_position.collateral_mint.as_ref()],
        bump = user_position.bump,
    )]
    pub user_position: Account<'info, UserPosition>,

    pub oracle: Account<'info, MockOracle>,

    #[account(mut)]
    pub pusd_mint: Account<'info, Mint>,

    #[account(mut)]
    pub user_pusd_ata: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BurnPusd<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(seeds = [b"global_config"], bump = global_config.bump)]
    pub global_config: Account<'info, GlobalConfig>,
    
    #[account(
        mut,
        seeds = [b"position", user.key().as_ref(), user_position.collateral_mint.as_ref()],
        bump = user_position.bump,
    )]
    pub user_position: Account<'info, UserPosition>,

    #[account(mut)]
    pub pusd_mint: Account<'info, Mint>,

    #[account(mut)]
    pub user_pusd_ata: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawCollateral<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(seeds = [b"global_config"], bump = global_config.bump)]
    pub global_config: Account<'info, GlobalConfig>,
    
    #[account(
        mut,
        seeds = [b"position", user.key().as_ref(), user_position.collateral_mint.as_ref()],
        bump = user_position.bump,
    )]
    pub user_position: Account<'info, UserPosition>,

    pub oracle: Account<'info, MockOracle>,
    
    #[account(mut)]
    pub user_collateral_ata: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub collateral_vault: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct InitOracle<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 8 + 1,
        seeds = [b"oracle", asset_mint.key().as_ref()],
        bump
    )]
    pub oracle: Account<'info, MockOracle>,
    
    pub asset_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateOracle<'info> {
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        has_one = authority,
    )]
    pub oracle: Account<'info, MockOracle>,
}
INNER_EOF
