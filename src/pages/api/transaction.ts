// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { createTransferCheckedInstruction, getAssociatedTokenAddressSync, getMint } from '@solana/spl-token';
import { Cluster, clusterApiUrl, Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js'
import type { NextApiRequest, NextApiResponse } from 'next'
import base58 from 'bs58'
import { AnchorProvider, Program, web3 } from '@coral-xyz/anchor';
import { GuestIdentityDriver, Metaplex, bundlrStorage, keypairIdentity, toMetaplexFile } from '@metaplex-foundation/js';
import * as fs from "fs";

type GetResponse = {
  label: string,
  icon: string,
};

export type PostRequest = {
  account: string,
};

export type PostResponse = {
  transaction: string,
  message: string,
  network: Cluster,
};

export type PostError = {
  error: string
};

// Response for GET request
function get(res: NextApiResponse<GetResponse>) {
  res.status(200).json({
    label: 'My Store',
    icon: 'https://solanapay.com/src/img/branding/Solanapay.com/downloads/gradient.svg',
  });
}

// Main body of the POST request, this returns the transaction
async function postImpl(
  network: Cluster,
  account: PublicKey,
  reference: PublicKey,
  shopKeypair: Keypair,
  pepperoni: number,
  cheese: number,
  mushrooms: number,
): Promise<PostResponse> {
  // Can also use a custom RPC here
  const endpoint = clusterApiUrl(network);
  const connection = new Connection(endpoint);

  // Devnet Bundlr address
  const BUNDLR_ADDRESS = "https://devnet.bundlr.network";


  // Initialise Metaplex with our shop keypair
  const nfts = Metaplex
    .make(connection)
    .use(keypairIdentity(shopKeypair))
    .use(
      bundlrStorage({
        address: BUNDLR_ADDRESS,
        providerUrl: endpoint,
        timeout: 60000,
      })
    )
    .nfts();

  const imageBuffer = fs.readFileSync('./public/pizza.svg');
  const file = toMetaplexFile(imageBuffer, 'pizza.svg');

  const { uri: metadataUri } = await nfts.uploadMetadata({
    name: 'Pizza Slice',
    symbol: 'PIZZA',
    description: 'The pizza loyalty reward scheme',
    image: file,
    attributes: [
      {
        trait_type: 'Pepperoni',
        value: pepperoni.toString()
      },
      {
        trait_type: 'Cheese',
        value: cheese.toString()
      },
      {
        trait_type: 'Mushrooms',
        value: mushrooms.toString()
      }
    ]
  });

  // The mint needs to sign the transaction, so we generate a new keypair for it
  const mintKeypair = Keypair.generate()

  // This is returned by nft-upload/upload.js
  const METADATA_URI = "https://arweave.net/HGrIpvlg4VkzR64ssmM8kR8uMzPBk10S84eg8PesAKs"

  // Create a transaction builder to create the NFT
  const transactionBuilder = await nfts.builders().create({
    uri: metadataUri, // use our metadata
    name: 'Pizza Slice',
    tokenOwner: account, // NFT is minted to the wallet submitting the transaction (buyer)
    updateAuthority: shopKeypair, // we retain update authority
    sellerFeeBasisPoints: 100, // 1% royalty
    useNewMint: mintKeypair, // we pass our mint in as the new mint to use
  })

  const mockWallet = {
    signTransaction: () => Promise.reject(),
    signAllTransactions: () => Promise.reject(),
    publicKey: shopKeypair.publicKey,
  };
  const anchorProvider = new AnchorProvider(connection, mockWallet, {});
  const programId = new PublicKey('GJk5YqJDMgTT8CFWfDZLFVnw8GXJucyTnqBcFcf2Dxcf');
  const program = await Program.at(programId, anchorProvider);

  const orderKeypair = Keypair.generate();
  const orderInstruction = await program.methods.init(account, pepperoni, cheese, mushrooms).accountsStrict({
    payer: shopKeypair.publicKey,
    order: orderKeypair.publicKey,
    rent: web3.SYSVAR_RENT_PUBKEY,
    systemProgram: web3.SystemProgram.programId,
  }).instruction()

  const usdcMintAddress = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
  const shopUsdcAddress = getAssociatedTokenAddressSync(usdcMintAddress, shopKeypair.publicKey);
  const accountUsdcAddress = getAssociatedTokenAddressSync(usdcMintAddress, account);

  const { decimals } = await getMint(connection, usdcMintAddress)

  const usdcAmount = 1;

  const transferInstruction = createTransferCheckedInstruction(
    accountUsdcAddress, // source
    usdcMintAddress, // mint
    shopUsdcAddress, // destination
    account, // owner of source address
    usdcAmount * (10 ** decimals), // amount
    decimals
  );

  // Add reference as a key to the instruction
  // This allows us to listen for this transaction
  transferInstruction.keys.push({
    pubkey: reference,
    isSigner: false,
    isWritable: false,
  });

  transactionBuilder.prepend({
    instruction: transferInstruction,
    signers: []
  }, {
    instruction: orderInstruction,
    signers: []
  });

  // Convert to transaction
  const latestBlockhash = await connection.getLatestBlockhash()
  const transaction = await transactionBuilder.toTransaction(latestBlockhash)

  // Partially sign as shop, order and mint accounts
  transaction.sign(shopKeypair, orderKeypair, mintKeypair);

  // Serialize the transaction and convert to base64 to return it
  const serializedTransaction = transaction.serialize({
    requireAllSignatures: false // account is a missing signature
  });
  const base64 = serializedTransaction.toString('base64');

  // Return the serialized transaction
  return {
    transaction: base64,
    message: 'Thankyou for your purchase!',
    network,
  };
}

// We pass eg. network in query params, this function extracts the value of a query param
function getFromQuery(
  req: NextApiRequest,
  field: string
): string | undefined {
  if (!(field in req.query)) return undefined;

  const value = req.query[field];
  if (typeof value === 'string') return value;
  // value is string[]
  if (value.length === 0) return undefined;
  return value[0];
}

async function post(
  req: NextApiRequest,
  res: NextApiResponse<PostResponse | PostError>
) {
  const { account } = req.body as PostRequest
  console.log(req.body)
  if (!account) {
    res.status(400).json({ error: 'No account provided' })
    return
  }

  const network = getFromQuery(req, 'network') as Cluster;
  if (!network) {
    res.status(400).json({ error: 'No network provided' });
    return
  }

  const reference = getFromQuery(req, 'reference');
  if (!reference) {
    res.status(400).json({ error: 'No reference provided' })
    return
  }

  const pepperoni = getFromQuery(req, 'pepperoni');
  if (!pepperoni) {
    res.status(400).json({ error: 'No pepperoni provided' })
    return
  }

  const cheese = getFromQuery(req, 'cheese');
  if (!cheese) {
    res.status(400).json({ error: 'No cheese provided' })
    return
  }

  const mushrooms = getFromQuery(req, 'mushrooms');
  if (!mushrooms) {
    res.status(400).json({ error: 'No mushrooms provided' })
    return
  }

  const shopPrivateKey = process.env.SHOP_PRIVATE_KEY
  if (!shopPrivateKey) {
    throw new Error('SHOP_PRIVATE_KEY not set')
  }
  // public key: Fkc4FN7PPhyGsAcHPW3dBBJ4BvtYkDr2rBFBgFpvy3nB
  const shopKeypair = Keypair.fromSecretKey(base58.decode(shopPrivateKey))

  try {
    const postResponse = await postImpl(
      network,
      new PublicKey(account),
      new PublicKey(reference),
      shopKeypair,
      Number(pepperoni),
      Number(cheese),
      Number(mushrooms)
    );
    res.status(200).json(postResponse)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error creating transaction' })
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetResponse | PostResponse | PostError>
) {
  if (req.method === 'GET') {
    return get(res);
  } else if (req.method === 'POST') {
    return await post(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
