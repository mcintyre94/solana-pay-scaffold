import { Keypair } from "@solana/web3.js";
import { SendTransactionRequest } from "components/SendTransactionRequest";
import { TransactionRequestQR } from "components/TransactionRequestQR";
import useTransactionListener from "hooks/useTransactionListener";
import type { NextPage } from "next";
import { useMemo, useState } from "react";
import { setEnvironmentData } from "worker_threads";

const Home: NextPage = () => {
  // Generate a public key that will be added to the transaction
  // so we can listen for it
  const reference = useMemo(() => Keypair.generate().publicKey, []);
  const [pepperoni, setPepperoni] = useState(0);
  const [cheese, setCheese] = useState(0);
  const [mushrooms, setMushrooms] = useState(0);

  // Listen for transactions with the reference
  useTransactionListener(reference);

  return (
    <div className="hero rounded-2xl bg-base-content">
      <div className="hero-content text-center">
        <div className="max-w-lg flex flex-col gap-6">
          <h1 className="text-3xl font-bold text-primary">Transaction Request</h1>

          <form className="flex flex-col gap-4">
            <div className="form-control flex flex-row justify-evenly">
              <label className="label text-primary" htmlFor="pepperoni">Pepperoni</label>
              <input type="number" min="0" max="10" className="input w-1/4" name="pepperoni" value={pepperoni} onChange={(e) => setPepperoni(e.target.valueAsNumber)} />
            </div>

            <div className="form-control flex flex-row justify-evenly">
              <label className="label text-primary" htmlFor="cheese">Cheese</label>
              <input type="number" min="0" max="10" className="input w-1/4" name="cheese" value={cheese} onChange={(e) => setCheese(e.target.valueAsNumber)} />
            </div>

            <div className="form-control flex flex-row justify-evenly">
              <label className="label text-primary" htmlFor="mushrooms">Mushrooms</label>
              <input type="number" min="0" max="10" className="input w-1/4" name="mushrooms" value={mushrooms} onChange={(e) => setMushrooms(e.target.valueAsNumber)} />
            </div>
          </form>

          {/* Button to send a transaction request */}
          <SendTransactionRequest reference={reference} pepperoni={pepperoni} cheese={cheese} mushrooms={mushrooms} />
          {/* QR code for a transaction request */}
          <TransactionRequestQR reference={reference} pepperoni={pepperoni} cheese={cheese} mushrooms={mushrooms} />
        </div>
      </div>
    </div>
  );
};

export default Home;
