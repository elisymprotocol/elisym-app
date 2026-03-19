import { useRef, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useElisymClient } from "@elisym/sdk/react";
import { ElisymIdentity, truncateKey } from "@elisym/sdk";
import { useUI } from "~/contexts/UIContext";

interface WizProduct {
  name: string;
  desc: string;
  price: string;
  photo: string | null;
}

function getWizData(data: Record<string, unknown>) {
  return {
    name: (data.name as string) || "",
    desc: (data.desc as string) || "",
    avatar: (data.avatar as string | null) ?? null,
    tags: (data.tags as string[]) || [],
    wallet: (data.wallet as string | null) ?? null,
    walletAddress: (data.walletAddress as string | null) ?? null,
    pricingMode: (data.pricingMode as string) || "single",
    generalPrice: (data.generalPrice as string) || "",
    products: (data.products as WizProduct[]) || [
      { name: "", desc: "", price: "", photo: null },
    ],
  };
}

export function ProviderWizard() {
  const [state, dispatch] = useUI();
  const { client } = useElisymClient();
  const { publicKey, select, connect, wallets } = useWallet();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const wiz = getWizData(state.wizardData);
  const step = state.wizardStep;

  const updateData = useCallback(
    (patch: Record<string, unknown>) => {
      dispatch({ type: "UPDATE_WIZARD_DATA", data: patch });
    },
    [dispatch],
  );

  async function handlePublish() {
    try {
      const identity =
        ElisymIdentity.fromLocalStorage("elisym:identity") ??
        ElisymIdentity.generate();
      identity.persist("elisym:identity");

      const capabilities = wiz.tags.map((t) =>
        t.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      );
      const price =
        wiz.pricingMode === "single" && wiz.generalPrice
          ? Math.round(parseFloat(wiz.generalPrice) * 1_000_000_000)
          : undefined;

      const payment = wiz.walletAddress
        ? {
            chain: "solana" as const,
            network: "devnet" as const,
            address: wiz.walletAddress,
            ...(price != null ? { job_price: price } : {}),
          }
        : undefined;

      const card = {
        name: wiz.name,
        description: wiz.desc,
        capabilities: capabilities.length > 0 ? capabilities : ["general"],
        payment,
      };

      await client.discovery.publishCapability(identity, card);
      await client.discovery.publishProfile(identity, wiz.name, wiz.desc);

      dispatch({ type: "SET_WIZARD_STEP", step: 5 });
    } catch (err) {
      alert(
        "Failed to publish: " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    }
  }

  function handleNext() {
    if (step === 4) {
      void handlePublish();
    } else if (step < 5) {
      dispatch({ type: "SET_WIZARD_STEP", step: step + 1 });
    }
  }

  function handleBack() {
    if (step > 1) {
      dispatch({ type: "SET_WIZARD_STEP", step: step - 1 });
    }
  }

  async function handleConnectWallet() {
    try {
      if (wallets.length > 0 && wallets[0]) {
        select(wallets[0].adapter.name);
      }
      await connect();
      const addr = publicKey?.toBase58();
      if (addr) {
        updateData({
          wallet: truncateKey(addr),
          walletAddress: addr,
        });
      }
    } catch (_err) {
      alert("Failed to connect wallet");
    }
  }

  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateData({ avatar: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
  }

  if (!state.wizardOpen) {
    return null;
  }

  // Update wallet display if connected after wizard opened
  if (publicKey && !wiz.wallet) {
    const addr = publicKey.toBase58();
    updateData({ wallet: truncateKey(addr), walletAddress: addr });
  }

  return (
    <div
      className="fixed inset-0 bg-black/25 z-[500] flex items-center justify-center backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          dispatch({ type: "CLOSE_WIZARD" });
        }
      }}
    >
      <div className="bg-surface border border-border rounded-[18px] w-[560px] max-w-[95vw] max-h-[90vh] overflow-y-auto p-8">
        {/* Top */}
        <div className="flex items-center justify-between mb-7">
          <h2 className="text-xl font-bold">Start Selling</h2>
          <button
            onClick={() => dispatch({ type: "CLOSE_WIZARD" })}
            className="bg-transparent border-none text-text-2 text-[22px] cursor-pointer hover:text-text"
          >
            &#10005;
          </button>
        </div>

        {/* Step dots */}
        {step < 5 && (
          <div className="flex gap-2 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded-sm transition-colors ${
                  i <= step ? "bg-accent" : "bg-border"
                }`}
              />
            ))}
          </div>
        )}

        {/* Step content */}
        {step === 1 && (
          <Step1
            wiz={wiz}
            updateData={updateData}
            avatarInputRef={avatarInputRef}
            onAvatarUpload={handleAvatarUpload}
          />
        )}
        {step === 2 && <Step2 wiz={wiz} updateData={updateData} />}
        {step === 3 && (
          <Step3 wiz={wiz} onConnect={() => void handleConnectWallet()} />
        )}
        {step === 4 && <Step4 wiz={wiz} updateData={updateData} />}
        {step === 5 && (
          <Step5 onClose={() => dispatch({ type: "CLOSE_WIZARD" })} />
        )}

        {/* Nav */}
        {step < 5 && (
          <div className="flex justify-between items-center mt-8 pt-5 border-t border-border">
            {step > 1 ? (
              <button
                onClick={handleBack}
                className="py-3 px-7 rounded-[10px] border border-border bg-transparent text-text-2 text-sm font-semibold cursor-pointer hover:border-text-2 hover:text-text"
              >
                Back
              </button>
            ) : (
              <div />
            )}
            <button
              onClick={handleNext}
              className="py-3 px-7 rounded-[10px] border-none bg-accent text-white text-sm font-semibold cursor-pointer hover:bg-accent-hover"
            >
              {step === 4 ? "Publish" : "Continue"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Step sub-components

function Step1({
  wiz,
  updateData,
  avatarInputRef,
  onAvatarUpload,
}: {
  wiz: ReturnType<typeof getWizData>;
  updateData: (patch: Record<string, unknown>) => void;
  avatarInputRef: React.RefObject<HTMLInputElement | null>;
  onAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <>
      <div className="text-xs text-text-2 mb-1.5">Step 1 of 4</div>
      <div className="text-lg font-semibold mb-6">About you</div>

      <div className="mb-5">
        <label className="block text-[13px] font-medium text-text-2 mb-2">
          Your name
        </label>
        <input
          className="w-full py-3 px-3.5 rounded-[10px] border border-border bg-surface-2 text-text text-sm outline-none transition-colors focus:border-accent"
          placeholder="John Doe"
          value={wiz.name}
          onChange={(e) => updateData({ name: e.target.value })}
        />
      </div>

      <div className="mb-5">
        <label className="block text-[13px] font-medium text-text-2 mb-2">
          Avatar
        </label>
        <div className="flex items-center gap-4">
          <div
            onClick={() => avatarInputRef.current?.click()}
            className="w-16 h-16 rounded-2xl bg-surface-2 border-2 border-dashed border-border flex items-center justify-center text-[28px] text-text-2 cursor-pointer hover:border-accent overflow-hidden shrink-0"
          >
            {wiz.avatar ? (
              <img
                src={wiz.avatar}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              "+"
            )}
          </div>
          <input
            type="file"
            ref={avatarInputRef}
            className="hidden"
            accept="image/*"
            onChange={onAvatarUpload}
          />
          <div className="text-[13px] text-text-2 leading-relaxed">
            <span
              className="text-accent cursor-pointer font-medium"
              onClick={() => avatarInputRef.current?.click()}
            >
              Upload image
            </span>
            <br />
            PNG, JPG up to 2MB
          </div>
        </div>
      </div>
    </>
  );
}

function Step2({
  wiz,
  updateData,
}: {
  wiz: ReturnType<typeof getWizData>;
  updateData: (patch: Record<string, unknown>) => void;
}) {
  const categories = ["UI/UX", "Summary", "Tools", "Other"];

  return (
    <>
      <div className="text-xs text-text-2 mb-1.5">Step 2 of 4</div>
      <div className="text-lg font-semibold mb-6">Describe your services</div>

      <div className="mb-5">
        <label className="block text-[13px] font-medium text-text-2 mb-2">
          Description
        </label>
        <textarea
          className="w-full py-3 px-3.5 rounded-[10px] border border-border bg-surface-2 text-text text-sm outline-none resize-y min-h-20 font-[inherit] transition-colors focus:border-accent"
          placeholder="What do you offer? What makes you unique?"
          value={wiz.desc}
          onChange={(e) => updateData({ desc: e.target.value })}
        />
      </div>

      <div className="mb-5">
        <label className="block text-[13px] font-medium text-text-2 mb-2">
          Category
        </label>
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => updateData({ tags: [cat] })}
              className={`py-2 px-[18px] rounded-[20px] border text-[13px] font-medium cursor-pointer transition-all ${
                wiz.tags.includes(cat)
                  ? "bg-accent border-accent text-white"
                  : "bg-transparent border-border text-text-2 hover:border-accent hover:text-text"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function Step3({
  wiz,
  onConnect,
}: {
  wiz: ReturnType<typeof getWizData>;
  onConnect: () => void;
}) {
  return (
    <>
      <div className="text-xs text-text-2 mb-1.5">Step 3 of 4</div>
      <div className="text-lg font-semibold mb-6">Connect wallet</div>

      <div className="flex items-center gap-3.5 p-5 bg-surface-2 rounded-xl border border-border">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center shrink-0">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="1.8">
            <rect x="2" y="6" width="20" height="13" rx="2" />
            <path d="M16 12.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z" fill="#fff" />
            <path d="M2 10h20" />
          </svg>
        </div>
        <div className="flex-1">
          <strong className="text-sm block mb-0.5">Solana Wallet</strong>
          <small className="text-xs text-text-2">
            Payments will be received to this address
          </small>
        </div>
        {wiz.wallet ? (
          <div className="font-mono text-[13px] text-green py-1.5 px-3 bg-green/10 rounded-lg">
            {wiz.wallet}
          </div>
        ) : (
          <button
            onClick={onConnect}
            className="btn btn-primary py-2 px-5 text-[13px]"
          >
            Connect
          </button>
        )}
      </div>
      {wiz.wallet && (
        <p className="text-green text-[13px] mt-3">
          Wallet connected successfully
        </p>
      )}
    </>
  );
}

function Step4({
  wiz,
  updateData,
}: {
  wiz: ReturnType<typeof getWizData>;
  updateData: (patch: Record<string, unknown>) => void;
}) {
  return (
    <>
      <div className="text-xs text-text-2 mb-1.5">Step 4 of 4</div>
      <div className="text-lg font-semibold mb-6">Your showcase</div>

      {/* Pricing toggle */}
      <div className="flex rounded-lg overflow-hidden border border-border mb-5">
        {(["single", "products"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => updateData({ pricingMode: mode })}
            className={`flex-1 py-2.5 text-[13px] font-medium border-none cursor-pointer text-center transition-all ${
              wiz.pricingMode === mode
                ? "bg-accent text-white"
                : "bg-transparent text-text-2"
            }`}
          >
            {mode === "single" ? "Single price" : "Multiple products"}
          </button>
        ))}
      </div>

      {wiz.pricingMode === "single" ? (
        <div className="mb-5">
          <label className="block text-[13px] font-medium text-text-2 mb-2">
            Price per task (SOL)
          </label>
          <input
            className="w-full py-3 px-3.5 rounded-[10px] border border-border bg-surface-2 text-text text-sm outline-none transition-colors focus:border-accent"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.25"
            value={wiz.generalPrice}
            onChange={(e) => updateData({ generalPrice: e.target.value })}
          />
        </div>
      ) : (
        <>
          {wiz.products.map((p, i) => (
            <div
              key={i}
              className="p-4 bg-surface-2 rounded-xl border border-border mb-3"
            >
              {wiz.products.length > 1 && (
                <button
                  onClick={() => {
                    const next = wiz.products.filter((_, j) => j !== i);
                    updateData({ products: next });
                  }}
                  className="float-right bg-transparent border-none text-text-2 text-base cursor-pointer p-1 hover:text-error"
                >
                  &#10005;
                </button>
              )}
              <div className="grid grid-cols-[1fr_120px] gap-3 mb-3">
                <div>
                  <label className="block text-[13px] font-medium text-text-2 mb-2">
                    Product name
                  </label>
                  <input
                    className="w-full py-3 px-3.5 rounded-[10px] border border-border bg-surface-2 text-text text-sm outline-none focus:border-accent"
                    placeholder="e.g. Landing page design"
                    value={p.name}
                    onChange={(e) => {
                      const next = [...wiz.products];
                      next[i] = { ...p, name: e.target.value };
                      updateData({ products: next });
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-text-2 mb-2">
                    Price (SOL)
                  </label>
                  <input
                    className="w-full py-3 px-3.5 rounded-[10px] border border-border bg-surface-2 text-text text-sm outline-none focus:border-accent"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.5"
                    value={p.price}
                    onChange={(e) => {
                      const next = [...wiz.products];
                      next[i] = { ...p, price: e.target.value };
                      updateData({ products: next });
                    }}
                  />
                </div>
              </div>
              <label className="block text-[13px] font-medium text-text-2 mb-2">
                Description
              </label>
              <textarea
                className="w-full py-3 px-3.5 rounded-[10px] border border-border bg-surface-2 text-text text-sm outline-none resize-y min-h-[50px] font-[inherit] focus:border-accent"
                placeholder="What's included?"
                value={p.desc}
                onChange={(e) => {
                  const next = [...wiz.products];
                  next[i] = { ...p, desc: e.target.value };
                  updateData({ products: next });
                }}
              />
            </div>
          ))}
          <button
            onClick={() =>
              updateData({
                products: [
                  ...wiz.products,
                  { name: "", desc: "", price: "", photo: null },
                ],
              })
            }
            className="w-full py-3.5 rounded-xl border-2 border-dashed border-border bg-transparent text-text-2 text-sm cursor-pointer hover:border-accent hover:text-accent"
          >
            + Add product
          </button>
        </>
      )}
    </>
  );
}

function Step5({ onClose }: { onClose: () => void }) {
  return (
    <div className="text-center py-5">
      <div className="w-[72px] h-[72px] rounded-full bg-green/15 flex items-center justify-center mx-auto mb-5 text-[32px]">
        &#10003;
      </div>
      <h3 className="text-xl mb-2">You're all set!</h3>
      <p className="text-text-2 text-sm leading-relaxed">
        Your provider profile has been published to the Nostr network. Customers
        can now discover and hire you on the elisym marketplace.
      </p>
      <button onClick={onClose} className="btn btn-primary mt-6">
        Go to Marketplace
      </button>
    </div>
  );
}
