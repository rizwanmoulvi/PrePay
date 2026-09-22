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


