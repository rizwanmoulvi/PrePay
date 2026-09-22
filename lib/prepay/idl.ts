export const IDL = {
  "address": "AmsV8UeyWRD6g7NZKMF4Z78h2xN7jQDweN1Bujn5VBwS",
  "metadata": {
    "address": "AmsV8UeyWRD6g7NZKMF4Z78h2xN7jQDweN1Bujn5VBwS"
  },
  "version": "0.1.0",
  "name": "prepay_contract",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "writable": true,
          "signer": false
        },
        {
          "name": "pusdMint",
          "writable": false,
          "signer": false
        },
        {
          "name": "systemProgram",
          "writable": false,
          "signer": false
        }
      ],
      "args": [],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ]
    },
    {
      "name": "initUserPosition",
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "userPosition",
          "writable": true,
          "signer": false
        },
        {
          "name": "collateralMint",
          "writable": false,
          "signer": false
        },
        {
          "name": "globalConfig",
          "writable": false,
          "signer": false
        },
        {
          "name": "systemProgram",
          "writable": false,
          "signer": false
        }
      ],
      "args": [],
      "discriminator": [
        131,
        197,
        183,
        39,
        12,
        98,
        108,
        68
      ]
    },
    {
      "name": "depositCollateral",
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "writable": false,
          "signer": false
        },
        {
          "name": "userPosition",
          "writable": true,
          "signer": false
        },
        {
          "name": "collateralMint",
          "writable": false,
          "signer": false
        },
        {
          "name": "userCollateralAta",
          "writable": true,
          "signer": false
        },
        {
          "name": "collateralVault",
          "writable": true,
          "signer": false
        },
        {
          "name": "tokenProgram",
          "writable": false,
          "signer": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ],
      "discriminator": [
        156,
        131,
        142,
        116,
        146,
        247,
        162,
        120
      ]
    },
    {
      "name": "mintPusd",
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "writable": false,
          "signer": false
        },
        {
          "name": "userPosition",
          "writable": true,
          "signer": false
        },
        {
          "name": "pusdMint",
          "writable": true,
          "signer": false
        },
        {
          "name": "userPusdAta",
          "writable": true,
          "signer": false
        },
        {
          "name": "tokenProgram",
          "writable": false,
          "signer": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "price",
          "type": "u64"
        }
      ],
      "discriminator": [
        142,
        219,
        188,
        248,
        129,
        92,
        19,
        247
      ]
    },
    {
      "name": "burnPusd",
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "writable": false,
          "signer": false
        },
        {
          "name": "userPosition",
          "writable": true,
          "signer": false
        },
        {
          "name": "pusdMint",
          "writable": true,
          "signer": false
        },
        {
          "name": "userPusdAta",
          "writable": true,
          "signer": false
        },
        {
          "name": "tokenProgram",
          "writable": false,
          "signer": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ],
      "discriminator": [
        181,
        237,
        123,
        106,
        232,
        116,
        189,
        237
      ]
    },
    {
      "name": "withdrawCollateral",
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "globalConfig",
          "writable": false,
          "signer": false
        },
        {
          "name": "userPosition",
          "writable": true,
          "signer": false
        },
        {
          "name": "userCollateralAta",
          "writable": true,
          "signer": false
        },
        {
          "name": "collateralVault",
          "writable": true,
          "signer": false
        },
        {
          "name": "tokenProgram",
          "writable": false,
          "signer": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "price",
          "type": "u64"
        }
      ],
      "discriminator": [
        115,
        135,
        168,
        106,
        139,
        214,
        138,
        150
      ]
    }
  ],
  "accounts": [
    {
      "name": "UserPosition",
      "discriminator": [
        251, 248, 209, 245,
         83, 234,  17,  27
      ]
    },
    {
      "name": "GlobalConfig",
      "discriminator": [
        149,   8, 156, 202,
        160, 252, 176, 217
      ]
    }
  ],
  "types": [
    {
      "name": "UserPosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "collateralMint",
            "type": "pubkey"
          },
          {
            "name": "collateralAmount",
            "type": "u64"
          },
          {
            "name": "debt",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "GlobalConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "pusdMint",
            "type": "pubkey"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};