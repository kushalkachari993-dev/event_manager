export type BakeryProfile = {
  businessName: string;
  phone: string;
  email: string;
  instagram: string;
  logoDataUrl: string;
};

export const emptyBakeryProfile: BakeryProfile = {
  businessName: "",
  phone: "",
  email: "",
  instagram: "",
  logoDataUrl: "",
};

export function parseBakeryProfile(value: unknown): BakeryProfile | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const fields = ["businessName", "phone", "email", "instagram", "logoDataUrl"] as const;
  if (fields.some((field) => typeof data[field] !== "string")) return null;
  const profile = Object.fromEntries(fields.map((field) => [field, (data[field] as string).trim()])) as BakeryProfile;
  if (!profile.businessName || profile.businessName.length > 100 || profile.phone.length > 40 || profile.email.length > 160 || profile.instagram.length > 80) return null;
  if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) return null;
  if (profile.logoDataUrl && (!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(profile.logoDataUrl) || profile.logoDataUrl.length > 120_000)) return null;
  return profile;
}

