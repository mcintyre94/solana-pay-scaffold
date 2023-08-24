// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { createTransferCheckedInstruction, getAssociatedTokenAddress, getAssociatedTokenAddressSync, getMint, transferChecked, transferCheckedInstructionData } from '@solana/spl-token';
import { Cluster, clusterApiUrl, Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js'
import type { NextApiRequest, NextApiResponse } from 'next'
import base58 from 'bs58'

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
): Promise<PostResponse> {
  // Can also use a custom RPC here
  const endpoint = clusterApiUrl(network);
  const connection = new Connection(endpoint);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

  const transaction = new Transaction({
    feePayer: shopKeypair.publicKey, // shop is fee payer
    blockhash,
    lastValidBlockHeight,
  });

  const shopPublicKey = new PublicKey('EkMGcCfkrs4Eqrd9C4CEhPDRY2Es8SPQs6cGWiBYVKzt');
  const usdcMintAddress = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
  const shopUsdcAddress = getAssociatedTokenAddressSync(usdcMintAddress, shopPublicKey);
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

  transaction.add(transferInstruction);

  // Partially sign as shop
  transaction.sign(shopKeypair);

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
