import { useState, useCallback, useRef, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  ElisymIdentity,
  PaymentService,
  type CapabilityCard,
  type PaymentRequestData,
} from "@elisym/sdk";
import { toast } from "sonner";
import { useElisymClient } from "./useElisymClient";
import { useOptionalIdentity } from "./useIdentity";
import { useJobHistory } from "./useJobHistory";
import { cacheSet } from "~/lib/localCache";
import { track } from "~/lib/analytics";

interface BuyCapabilityOptions {
  agentPubkey: string;
  agentName: string;
  agentPicture?: string;
  card: CapabilityCard;
}

export function useBuyCapability({
  agentPubkey,
  agentName,
  agentPicture,
  card,
}: BuyCapabilityOptions) {
  const { client } = useElisymClient();
  const idCtx = useOptionalIdentity();
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const wallet = publicKey?.toBase58() ?? "";
  const { saveJob, updateJob } = useJobHistory({ wallet });

  const [buying, setBuying] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [rated, setRated] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const buy = useCallback(async (input = "") => {
    if (buying) return;
    if (!publicKey) {
      toast.error("Connect your wallet first");
      return;
    }

    setBuying(true);
    setError(null);
    setResult(null);

    try {
      const identity =
        idCtx?.identity ??
        ElisymIdentity.fromLocalStorage("elisym:identity") ??
        ElisymIdentity.generate();

      const capability = card.capabilities[0] || card.name;

      // 1. Submit job request
      const jobEventId = await client.marketplace.submitJobRequest(identity, {
        input,
        capability,
        providerPubkey: agentPubkey,
      });
      setJobId(jobEventId);

      // 2. Save initial job
      saveJob({
        jobEventId,
        agentPubkey,
        agentName,
        agentPicture,
        capability,
        status: "submitted",
        createdAt: Date.now(),
      });

      toast.info("Job submitted, waiting for provider...");

      // 3. Subscribe to updates
      const cleanup = client.marketplace.subscribeToJobUpdates(
        jobEventId,
        agentPubkey,
        identity.publicKey,
        {
          onFeedback: async (status, amount, paymentRequestJson) => {
            if (status !== "payment-required" || !paymentRequestJson) return;

            try {
              // Validate payment request
              const validationError = PaymentService.validatePaymentFee(
                paymentRequestJson,
                card.payment?.address,
              );
              if (validationError) {
                throw new Error(validationError);
              }

              const paymentRequest: PaymentRequestData = JSON.parse(paymentRequestJson);

              // Build and send transaction
              const tx = PaymentService.buildPaymentTransaction(
                publicKey,
                paymentRequest,
              );
              const { blockhash } = await connection.getLatestBlockhash();
              tx.recentBlockhash = blockhash;
              tx.feePayer = publicKey;

              toast.info("Approve the transaction in your wallet...");

              const signature = await sendTransaction(tx, connection);
              await connection.confirmTransaction(signature, "confirmed");

              // Publish payment confirmation
              await client.marketplace.submitPaymentConfirmation(
                identity,
                jobEventId,
                agentPubkey,
                signature,
              );

              updateJob(jobEventId, {
                status: "payment-completed",
                paymentAmount: amount,
                txHash: signature,
              });

              toast.success("Payment sent, waiting for result...");
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Payment failed";
              setError(msg);
              updateJob(jobEventId, { status: "error" });
              setBuying(false);
              toast.error(msg);
            }
          },

          onResult: (content, eventId) => {
            setResult(content);
            updateJob(jobEventId, { status: "completed", result: content });

            // Store in IndexedDB
            cacheSet(`purchase:${jobEventId}`, {
              result: content,
              eventId,
              receivedAt: Date.now(),
            });

            setBuying(false);
            toast.success("Result received!");
          },

          onError: (errMsg) => {
            setError(errMsg);
            updateJob(jobEventId, { status: "error" });
            setBuying(false);
            toast.error(errMsg);
          },
        },
        120_000,
        identity.secretKey,
      );

      cleanupRef.current = cleanup;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit job";
      setError(msg);
      setBuying(false);
      toast.error(msg);
    }
  }, [
    buying,
    publicKey,
    client,
    idCtx?.identity,
    agentPubkey,
    agentName,
    agentPicture,
    card,
    connection,
    sendTransaction,
    saveJob,
    updateJob,
  ]);

  const rate = useCallback(async (positive: boolean) => {
    if (!jobId || rated) return;
    try {
      const identity =
        idCtx?.identity ??
        ElisymIdentity.fromLocalStorage("elisym:identity") ??
        ElisymIdentity.generate();
      await client.marketplace.submitFeedback(identity, jobId, agentPubkey, positive);
      setRated(true);
      await cacheSet(`rated:${jobId}`, true);
      track("rate-result", { rating: positive ? "good" : "bad" });
      toast.success("Feedback sent");
    } catch {
      toast.error("Failed to send feedback");
    }
  }, [jobId, rated, client, idCtx?.identity, agentPubkey]);

  return { buy, buying, result, error, jobId, rate, rated };
}
