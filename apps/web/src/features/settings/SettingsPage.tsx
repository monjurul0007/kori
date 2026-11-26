import { DESKTOP_QUERY, useMediaQuery } from "@/lib/useMediaQuery";

import { GeneralSettings } from "./GeneralSettings";
import { SettingsMenu } from "./SettingsMenu";

/** `/settings`: General on desktop (the sub-menu is beside it), the grouped list on phones. */
export function SettingsPage() {
  return useMediaQuery(DESKTOP_QUERY) ? <GeneralSettings /> : <SettingsMenu />;
}
