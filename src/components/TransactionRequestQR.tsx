import { createQR, encodeURL, TransactionRequestURLFields } from "@solana/pay";
import { PublicKey } from "@solana/web3.js";
import { useNetworkConfiguration } from "contexts/NetworkConfigurationProvider";
import { FC, useEffect, useRef } from "react";

type TransactionRequestQRProps = {
  reference: PublicKey,
  pepperoni: number,
  cheese: number,
  mushrooms: number,
};

export const TransactionRequestQR: FC<TransactionRequestQRProps> = ({ reference, pepperoni, cheese, mushrooms }) => {
  const qrRef = useRef<HTMLDivElement>(null);
  const { networkConfiguration } = useNetworkConfiguration();

  useEffect(() => {
    // window.location is only available in the browser, so create the URL in here
    const { location } = window
    const apiUrl = `${location.protocol}//${location.host}/api/transaction?network=${networkConfiguration}&reference=${reference.toBase58()}&pepperoni=${pepperoni}&cheese=${cheese}&mushrooms=${mushrooms}`
    const urlParams: TransactionRequestURLFields = {
      link: new URL(apiUrl),
      label: "My Store",
    };
    const solanaUrl = encodeURL(urlParams);
    const qr = createQR(solanaUrl, 512, 'transparent')
    qr.update({ backgroundOptions: { round: 1000 } });
    if (qrRef.current) {
      qrRef.current.innerHTML = ''
      qr.append(qrRef.current)
    }
  }, [networkConfiguration, reference, pepperoni, cheese, mushrooms]);

  return (
    <div className="rounded-2xl">
      <div ref={qrRef} />
    </div>
  )
}
