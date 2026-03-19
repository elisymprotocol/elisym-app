import { useRef, useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useElisymClient } from "@elisym/sdk/react";
import { ElisymIdentity } from "@elisym/sdk";
import { useUI } from "~/contexts/UIContext";
import { uploadToNostrBuild } from "~/lib/uploadImage";

interface WizProduct {
  name: string;
  desc: string;
  price: string;
  tags: string[];
  photoFile: File | null;
  photoPreview: string | null;
}

function getWizData(data: Record<string, unknown>) {
  return {
    name: (data.name as string) || "",
    desc: (data.desc as string) || "",
    avatarFile: (data.avatarFile as File | null) ?? null,
    avatarPreview: (data.avatarPreview as string | null) ?? null,
    products: (data.products as WizProduct[]) || [
      { name: "", desc: "", price: "", tags: [], photoFile: null, photoPreview: null },
    ],
  };
}

const CATEGORIES = ["UI/UX", "Summary", "Tools", "Code", "Data", "Other"];

export function ProviderWizard() {
  const [state, dispatch] = useUI();
  const { client } = useElisymClient();
  const { publicKey } = useWallet();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [publishing, setPublishing] = useState(false);

  const wiz = getWizData(state.wizardData);
  const step = state.wizardStep;

  const updateData = useCallback(
    (patch: Record<string, unknown>) => {
      dispatch({ type: "UPDATE_WIZARD_DATA", data: patch });
    },
    [dispatch],
  );

  async function handlePublish() {
    if (publishing) return;
    setPublishing(true);

    try {
      const identity =
        ElisymIdentity.fromLocalStorage("elisym:identity") ??
        ElisymIdentity.generate();
      identity.persist("elisym:identity");

      // Upload avatar if present
      let avatarUrl: string | undefined;
      if (wiz.avatarFile) {
        avatarUrl = await uploadToNostrBuild(wiz.avatarFile, identity);
      }

      // Publish profile (kind:0)
      await client.discovery.publishProfile(
        identity,
        wiz.name,
        wiz.desc,
        avatarUrl,
      );

      // Get wallet address for payment info
      const walletAddress = publicKey?.toBase58();

      // Publish each product as a separate capability (kind:31990)
      for (const product of wiz.products) {
        if (!product.name) continue;

        let imageUrl: string | undefined;
        if (product.photoFile) {
          imageUrl = await uploadToNostrBuild(product.photoFile, identity);
        }

        const capabilities = product.tags.length > 0
          ? product.tags.map((t) => t.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
          : ["general"];

        const price = product.price
          ? Math.round(parseFloat(product.price) * 1_000_000_000)
          : undefined;

        const payment = walletAddress
          ? {
              chain: "solana" as const,
              network: "devnet" as const,
              address: walletAddress,
              ...(price != null ? { job_price: price } : {}),
            }
          : undefined;

        const card = {
          name: product.name,
          description: product.desc,
          capabilities,
          payment,
          image: imageUrl,
        };

        await client.discovery.publishCapability(identity, card);
      }

      dispatch({ type: "SET_WIZARD_STEP", step: 3 });
    } catch (err) {
      alert(
        "Failed to publish: " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    } finally {
      setPublishing(false);
    }
  }

  function handleNext() {
    if (step === 2) {
      void handlePublish();
    } else if (step < 3) {
      dispatch({ type: "SET_WIZARD_STEP", step: step + 1 });
    }
  }

  function handleBack() {
    if (step > 1) {
      dispatch({ type: "SET_WIZARD_STEP", step: step - 1 });
    }
  }

  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateData({
        avatarFile: file,
        avatarPreview: ev.target?.result as string,
      });
    };
    reader.readAsDataURL(file);
  }

  if (!state.wizardOpen) {
    return null;
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
        {step < 3 && (
          <div className="flex gap-2 mb-8">
            {[1, 2].map((i) => (
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
          <StepSuccess onClose={() => dispatch({ type: "CLOSE_WIZARD" })} />
        )}

        {/* Nav */}
        {step < 3 && (
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
              disabled={publishing}
              className="py-3 px-7 rounded-[10px] border-none bg-accent text-white text-sm font-semibold cursor-pointer hover:bg-accent-hover disabled:opacity-50"
            >
              {publishing ? "Publishing..." : step === 2 ? "Publish" : "Continue"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Step sub-components

type WizData = ReturnType<typeof getWizData>;

function Step1({
  wiz,
  updateData,
  avatarInputRef,
  onAvatarUpload,
}: {
  wiz: WizData;
  updateData: (patch: Record<string, unknown>) => void;
  avatarInputRef: React.RefObject<HTMLInputElement | null>;
  onAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <>
      <div className="text-xs text-text-2 mb-1.5">Step 1 of 2</div>
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
            {wiz.avatarPreview ? (
              <img
                src={wiz.avatarPreview}
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
    </>
  );
}

function Step2({
  wiz,
  updateData,
}: {
  wiz: WizData;
  updateData: (patch: Record<string, unknown>) => void;
}) {
  function updateProduct(index: number, patch: Partial<WizProduct>) {
    const next = [...wiz.products];
    const existing = next[index];
    if (!existing) return;
    next[index] = { ...existing, ...patch };
    updateData({ products: next });
  }

  function removeProduct(index: number) {
    const next = wiz.products.filter((_, j) => j !== index);
    updateData({ products: next });
  }

  function addProduct() {
    updateData({
      products: [
        ...wiz.products,
        { name: "", desc: "", price: "", tags: [], photoFile: null, photoPreview: null },
      ],
    });
  }

  function handleProductPhoto(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateProduct(index, {
        photoFile: file,
        photoPreview: ev.target?.result as string,
      });
    };
    reader.readAsDataURL(file);
  }

  function toggleTag(index: number, tag: string) {
    const product = wiz.products[index];
    if (!product) return;
    const tags = product.tags.includes(tag)
      ? product.tags.filter((t) => t !== tag)
      : [...product.tags, tag];
    updateProduct(index, { tags });
  }

  return (
    <>
      <div className="text-xs text-text-2 mb-1.5">Step 2 of 2</div>
      <div className="text-lg font-semibold mb-6">Your products</div>

      {wiz.products.map((p, i) => (
        <ProductCard
          key={i}
          product={p}
          index={i}
          canRemove={wiz.products.length > 1}
          onUpdate={updateProduct}
          onRemove={removeProduct}
          onPhotoChange={handleProductPhoto}
          onToggleTag={toggleTag}
        />
      ))}

      <button
        onClick={addProduct}
        className="w-full py-3.5 rounded-xl border-2 border-dashed border-border bg-transparent text-text-2 text-sm cursor-pointer hover:border-accent hover:text-accent"
      >
        + Add product
      </button>
    </>
  );
}

function ProductCard({
  product,
  index,
  canRemove,
  onUpdate,
  onRemove,
  onPhotoChange,
  onToggleTag,
}: {
  product: WizProduct;
  index: number;
  canRemove: boolean;
  onUpdate: (index: number, patch: Partial<WizProduct>) => void;
  onRemove: (index: number) => void;
  onPhotoChange: (index: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleTag: (index: number, tag: string) => void;
}) {
  const photoInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="p-4 bg-surface-2 rounded-xl border border-border mb-3">
      {canRemove && (
        <button
          onClick={() => onRemove(index)}
          className="float-right bg-transparent border-none text-text-2 text-base cursor-pointer p-1 hover:text-error"
        >
          &#10005;
        </button>
      )}

      {/* Photo upload */}
      <div className="mb-3">
        <div
          onClick={() => photoInputRef.current?.click()}
          className="w-full h-32 rounded-lg bg-surface border border-dashed border-border flex items-center justify-center cursor-pointer hover:border-accent overflow-hidden"
        >
          {product.photoPreview ? (
            <img
              src={product.photoPreview}
              alt="Product"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-text-2 text-sm">+ Add photo</span>
          )}
        </div>
        <input
          type="file"
          ref={photoInputRef}
          className="hidden"
          accept="image/*"
          onChange={(e) => onPhotoChange(index, e)}
        />
      </div>

      <div className="grid grid-cols-[1fr_120px] gap-3 mb-3">
        <div>
          <label className="block text-[13px] font-medium text-text-2 mb-2">
            Product name
          </label>
          <input
            className="w-full py-3 px-3.5 rounded-[10px] border border-border bg-surface text-text text-sm outline-none focus:border-accent"
            placeholder="e.g. Landing page design"
            value={product.name}
            onChange={(e) => onUpdate(index, { name: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-[13px] font-medium text-text-2 mb-2">
            Price (SOL)
          </label>
          <input
            className="w-full py-3 px-3.5 rounded-[10px] border border-border bg-surface text-text text-sm outline-none focus:border-accent"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.5"
            value={product.price}
            onChange={(e) => onUpdate(index, { price: e.target.value })}
          />
        </div>
      </div>

      <div className="mb-3">
        <label className="block text-[13px] font-medium text-text-2 mb-2">
          Description
        </label>
        <textarea
          className="w-full py-3 px-3.5 rounded-[10px] border border-border bg-surface text-text text-sm outline-none resize-y min-h-[50px] font-[inherit] focus:border-accent"
          placeholder="What's included?"
          value={product.desc}
          onChange={(e) => onUpdate(index, { desc: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-[13px] font-medium text-text-2 mb-2">
          Tags
        </label>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((tag) => (
            <button
              key={tag}
              onClick={() => onToggleTag(index, tag)}
              className={`py-1.5 px-3 rounded-[20px] border text-xs font-medium cursor-pointer transition-all ${
                product.tags.includes(tag)
                  ? "bg-accent border-accent text-white"
                  : "bg-transparent border-border text-text-2 hover:border-accent hover:text-text"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepSuccess({ onClose }: { onClose: () => void }) {
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
