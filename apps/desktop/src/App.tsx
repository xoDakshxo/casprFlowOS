import { GlassPane } from "@casprflowos/ui";

import logoUrl from "../../../assets/logo/logo-white.svg";

export const App = () => {
  return (
    <main className="app-shell" aria-label="casprFlowOS">
      <GlassPane className="splash" aria-labelledby="app-title">
        <img className="splash-logo" src={logoUrl} alt="" aria-hidden="true" />
        <h1 id="app-title">casprFlowOS</h1>
      </GlassPane>
    </main>
  );
};
