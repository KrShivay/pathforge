import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LABORATORY_PROFILE, loadLaboratoryProfile, normalizeLaboratoryProfile, saveLaboratoryProfile, type LaboratoryProfile } from "./branding";

interface BrandingContextValue { profile: LaboratoryProfile; hydrated: boolean; updateProfile: (profile: LaboratoryProfile) => void; restoreDefault: () => void; }
const BrandingContext = createContext<BrandingContextValue | undefined>(undefined);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<LaboratoryProfile>(() => loadLaboratoryProfile());
  const value = useMemo(() => ({ profile, hydrated: true, updateProfile(next: LaboratoryProfile) { saveLaboratoryProfile(next); setProfile(next); }, restoreDefault() { const next = normalizeLaboratoryProfile(DEFAULT_LABORATORY_PROFILE); saveLaboratoryProfile(next); setProfile(next); } }), [profile]);
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}
export function useBranding() { const value = useContext(BrandingContext); if (!value) throw new Error("useBranding must be used inside BrandingProvider"); return value; }
