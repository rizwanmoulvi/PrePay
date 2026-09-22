use anchor_lang::prelude::*;

#[error_code]
pub enum PrePayError {
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
