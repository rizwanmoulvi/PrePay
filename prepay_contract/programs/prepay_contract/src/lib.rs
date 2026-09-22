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
            ("ANDURIL", "bRgmAmDfVDhuRR868LGYjWURkFm3SWkwv9fBf25VMbm", 6000),
            ("ANTHROPIC", "2jCBRfWZ8Q9Fwwou3mngXNjWyHxQwbfrAZQuc84hoqAf", 6000),
            ("FIGUREAI", "Ha7MHARu4v8qYWw3qPGSKBsJ7MDdNUdPpFrr8s4Atkm6", 5500),
            ("KALSHI", "EsdHBFGgJHgdDo4BjVXM3N7BBDhRs12bhGwASRaDwt44", 5000),
            ("NEURALINK", "DWDz8jSLrf2tHTjBN2RyPokDPFtGQhD1SyxJPt6TqXTk", 5000),
            ("OPENAI", "CNj8VP16fe8THWvnaCjD8rQJGojmcqwEG1i9YgkrMicL", 6000),
            ("POLYMARKET", "DQQh9nsXTxKjd1tX5KKw1AJ7JkXD53dBjV6hJ6yMBDkk", 5000),
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
            .ok_or(PrePayError::UnsupportedAsset)?;
        
        position.owner = ctx.accounts.user.key();
        position.collateral_mint = asset.mint;
        position.collateral_amount = 0;
        position.debt = 0;
        position.bump = ctx.bumps.user_position;

        Ok(())
    }

    pub fn deposit_collateral(ctx: Context<DepositCollateral>, amount: u64) -> Result<()> {
        let config = &ctx.accounts.global_config;
        require!(!config.paused, PrePayError::ProtocolPaused);
        require!(amount > 0, PrePayError::InvalidAmount);

        let asset = config.assets.iter().find(|a| a.mint == ctx.accounts.collateral_mint.key())
            .ok_or(PrePayError::UnsupportedAsset)?;
        require!(asset.enabled, PrePayError::AssetDisabled);

        let position = &mut ctx.accounts.user_position;
        require!(position.collateral_mint == ctx.accounts.collateral_mint.key(), PrePayError::WrongCollateralMint);

        let cpi_accounts = Transfer {
            from: ctx.accounts.user_collateral_ata.to_account_info(),
            to: ctx.accounts.collateral_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        position.collateral_amount = position.collateral_amount.checked_add(amount).ok_or(PrePayError::MathOverflow)?;

        Ok(())
    }

    pub fn mint_pusd(ctx: Context<MintPusd>, amount: u64, price: u64) -> Result<()> {
        let config = &ctx.accounts.global_config;
        require!(!config.paused, PrePayError::ProtocolPaused);
        require!(amount > 0, PrePayError::InvalidAmount);

        let position = &mut ctx.accounts.user_position;
        
        let asset = config.assets.iter().find(|a| a.mint == position.collateral_mint)
            .ok_or(PrePayError::UnsupportedAsset)?;
        require!(asset.enabled, PrePayError::AssetDisabled);

        let value_usd = (position.collateral_amount as u128)
            .checked_mul(price as u128).ok_or(PrePayError::MathOverflow)?
            .checked_div(1_000_000).ok_or(PrePayError::MathOverflow)?;

        let max_debt = value_usd
            .checked_mul(asset.ltv_bps as u128).ok_or(PrePayError::MathOverflow)?
            .checked_div(10000).ok_or(PrePayError::MathOverflow)?;

        let new_debt = (position.debt as u128)
            .checked_add(amount as u128).ok_or(PrePayError::MathOverflow)?;

        require!(new_debt <= max_debt, PrePayError::InsufficientCollateral);

        position.debt = new_debt as u64;

        let seeds = &[b"global_config_2".as_ref(), &[config.bump]];
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
        require!(!config.paused, PrePayError::ProtocolPaused);
        require!(amount > 0, PrePayError::InvalidAmount);

        let position = &mut ctx.accounts.user_position;
        require!(amount <= position.debt, PrePayError::InsufficientDebt);

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

    pub fn withdraw_collateral(ctx: Context<WithdrawCollateral>, amount: u64, price: u64) -> Result<()> {
        let config = &ctx.accounts.global_config;
        require!(!config.paused, PrePayError::ProtocolPaused);
        require!(amount > 0, PrePayError::InvalidAmount);

        let position = &mut ctx.accounts.user_position;
        require!(amount <= position.collateral_amount, PrePayError::InsufficientCollateral);

        let asset = config.assets.iter().find(|a| a.mint == position.collateral_mint)
            .ok_or(PrePayError::UnsupportedAsset)?;
        
        let remaining_collateral = position.collateral_amount.checked_sub(amount).unwrap();
        
        let value_usd = (remaining_collateral as u128)
            .checked_mul(price as u128).ok_or(PrePayError::MathOverflow)?
            .checked_div(1_000_000).ok_or(PrePayError::MathOverflow)?;

        let max_debt = value_usd
            .checked_mul(asset.ltv_bps as u128).ok_or(PrePayError::MathOverflow)?
            .checked_div(10000).ok_or(PrePayError::MathOverflow)?;

        require!((position.debt as u128) <= max_debt, PrePayError::InsufficientCollateral);

        position.collateral_amount = remaining_collateral;

        let seeds = &[b"global_config_2".as_ref(), &[config.bump]];
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


}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 1 + 1 + 4 + (7 * (32 + 16 + 2 + 1)),
        seeds = [b"global_config_2"],
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
    
    #[account(seeds = [b"global_config_2"], bump = global_config.bump)]
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
pub struct BurnPusd<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(seeds = [b"global_config_2"], bump = global_config.bump)]
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
    
    #[account(seeds = [b"global_config_2"], bump = global_config.bump)]
    pub global_config: Account<'info, GlobalConfig>,
    
    #[account(
        mut,
        seeds = [b"position", user.key().as_ref(), user_position.collateral_mint.as_ref()],
        bump = user_position.bump,
    )]
    pub user_position: Account<'info, UserPosition>,
    
    #[account(mut)]
    pub user_collateral_ata: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub collateral_vault: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}


